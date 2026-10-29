import { BackgroundGeolocation } from "@capgo/background-geolocation";

const client = window.appSupabaseClient;
const settingsShareButton = document.getElementById("locationShareToggle");
const worldShareButton = document.getElementById("worldLocationShareToggle");
const pairStatus = document.getElementById("locationPairStatus");
const shareStatus = document.getElementById("locationShareStatus");
const partnerCard = document.getElementById("locationPartnerCard");
const partnerNameLabel = document.getElementById("locationPartnerName");
const partnerUpdatedLabel = document.getElementById("locationPartnerUpdated");
const partnerMapLink = document.getElementById("locationPartnerMapLink");
const mapFrame = document.getElementById("locationMapFrame");
const mapEmpty = document.getElementById("locationMapEmpty");
const mapMessage = document.getElementById("locationMapMessage");
const mapTitle = document.getElementById("worldLocationTitle");
const mapUpdated = document.getElementById("worldLocationUpdated");
const liveIndicator = document.getElementById("worldLocationIndicator");

const state = {
    user: null,
    coupleId: null,
    partnerId: null,
    partnerName: "Sua pessoa",
    ownLocation: null,
    partnerLocation: null,
    sharing: false,
    tracking: false,
    busy: false,
    generation: 0,
    refreshTimer: null,
    lastMapLocation: null
};

const platform = window.Capacitor?.getPlatform?.() || "web";
const isNative = Boolean(window.Capacitor?.isNativePlatform?.());
const buttonElements = [settingsShareButton, worldShareButton].filter(Boolean);

function setStatus(message) {
    if (shareStatus) shareStatus.textContent = message;
    if (mapUpdated) mapUpdated.textContent = message;
}

function formatAge(value) {
    if (!value) return "No location shared yet.";
    const updated = new Date(value);
    if (Number.isNaN(updated.getTime())) return "Last location time unavailable.";
    const minutes = Math.max(0, Math.floor((Date.now() - updated.getTime()) / 60000));
    if (minutes < 1) return "Updated just now.";
    if (minutes === 1) return "Updated 1 minute ago.";
    if (minutes < 60) return `Updated ${minutes} minutes ago.`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "Updated 1 hour ago.";
    if (hours < 24) return `Updated ${hours} hours ago.`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "Updated 1 day ago." : `Updated ${days} days ago.`;
}

function setButtons() {
    const enabled = Boolean(state.user && state.coupleId && state.partnerId && !state.busy);
    buttonElements.forEach(button => {
        button.disabled = !enabled;
        button.textContent = state.sharing || state.tracking ? "Stop sharing" : "Share my location";
    });
}

function showMapEmpty(message) {
    mapEmpty.hidden = false;
    mapFrame.hidden = true;
    mapMessage.textContent = message;
    liveIndicator.textContent = "OFF";
    liveIndicator.classList.remove("is-live");
    mapTitle.textContent = "Waiting for your shared location";
}

function updateMap(location) {
    if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
        state.lastMapLocation = null;
        showMapEmpty(state.sharing
            ? "Your sharing is on. Waiting for your first location fix."
            : "Sign in and turn on location sharing to see the map.");
        return;
    }

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    const changed = !state.lastMapLocation
        || Math.abs(latitude - state.lastMapLocation.latitude) > 0.001
        || Math.abs(longitude - state.lastMapLocation.longitude) > 0.001;
    if (changed) {
        const deltaLat = 0.025;
        const deltaLon = 0.025;
        const bounds = [longitude - deltaLon, latitude - deltaLat, longitude + deltaLon, latitude + deltaLat].join(",");
        mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bounds)}&layer=mapnik&marker=${latitude}%2C${longitude}`;
        state.lastMapLocation = { latitude, longitude };
    }
    mapEmpty.hidden = true;
    mapFrame.hidden = false;
    mapTitle.textContent = `${state.partnerName}'s location`;
    const age = formatAge(location.updated_at);
    mapUpdated.textContent = age;
    liveIndicator.textContent = Date.now() - new Date(location.updated_at).getTime() < 5 * 60 * 1000 ? "LIVE" : "LAST SEEN";
    liveIndicator.classList.toggle("is-live", liveIndicator.textContent === "LIVE");
}

function updateSharePresentation() {
    const sharing = state.sharing || state.tracking;
    setButtons();
    if (settingsShareButton) settingsShareButton.classList.toggle("is-sharing", sharing);
    if (worldShareButton) worldShareButton.classList.toggle("is-sharing", sharing);

    if (pairStatus) {
        if (!state.user) pairStatus.textContent = "Sign in with one of your couple accounts to enable location sharing.";
        else if (!state.coupleId || !state.partnerId) pairStatus.textContent = "This account is not linked to the other account yet.";
        else pairStatus.textContent = sharing
            ? `You are sharing with ${state.partnerName}. You can stop anytime.`
            : `Linked with ${state.partnerName}. Your location is not being shared.`;
    }

    if (partnerCard) partnerCard.hidden = !state.partnerLocation;
    if (state.partnerLocation) {
        partnerNameLabel.textContent = `${state.partnerName}'s location`;
        partnerUpdatedLabel.textContent = formatAge(state.partnerLocation.updated_at);
        partnerMapLink.hidden = false;
        partnerMapLink.onclick = event => {
            event.preventDefault();
            document.querySelector('[data-page="world"]')?.click();
            document.getElementById("settingsDialog")?.close();
        };
        updateMap(state.partnerLocation);
    } else {
        partnerCard.hidden = true;
        if (state.sharing) {
            showMapEmpty("Your sharing is on. The map will show your partner when they turn on sharing.");
        } else {
            showMapEmpty("Your partner has not turned on location sharing yet.");
        }
    }
}

async function loadPairAndLocations() {
    if (!client || !state.user) {
        state.coupleId = null;
        state.partnerId = null;
        state.ownLocation = null;
        state.partnerLocation = null;
        state.sharing = false;
        updateSharePresentation();
        return;
    }

    const { data: coupleId, error: coupleError } = await client.rpc("current_couple_id");
    if (coupleError || !coupleId) {
        state.coupleId = null;
        state.partnerId = null;
        if (pairStatus) pairStatus.textContent = "The couple link is not ready yet. Check the Supabase setup query.";
        updateSharePresentation();
        return;
    }
    state.coupleId = coupleId;

    const { data: members, error: membersError } = await client
        .from("couple_members")
        .select("user_id, display_name")
        .eq("couple_id", coupleId);
    if (membersError) {
        state.partnerId = null;
        if (pairStatus) pairStatus.textContent = "Could not load the linked account. Check the Supabase policies.";
        updateSharePresentation();
        return;
    }
    const partner = (members || []).find(member => member.user_id !== state.user.id);
    if (!partner) {
        state.partnerId = null;
        updateSharePresentation();
        return;
    }
    state.partnerId = partner.user_id;
    state.partnerName = partner.display_name || "Your partner";

    const [ownResult, partnerResult] = await Promise.all([
        client.from("location_shares").select("user_id, latitude, longitude, accuracy_m, sharing, updated_at")
            .eq("user_id", state.user.id).maybeSingle(),
        client.from("location_shares").select("user_id, latitude, longitude, accuracy_m, sharing, updated_at")
            .eq("user_id", state.partnerId).maybeSingle()
    ]);
    if (ownResult.error || partnerResult.error) {
        if (pairStatus) pairStatus.textContent = "Location tables are not ready yet. Run the private Supabase setup SQL.";
        updateSharePresentation();
        return;
    }

    state.ownLocation = ownResult.data || null;
    state.partnerLocation = partnerResult.data?.sharing ? partnerResult.data : null;
    state.sharing = Boolean(state.ownLocation?.sharing);
    updateSharePresentation();

    if (state.sharing && !state.tracking) {
        try {
            await startTracking({ requestPermissions: false });
        } catch (error) {
            setStatus(error?.message || "Sharing is on, but this device could not resume location updates.");
        }
    }
}

async function saveLocation(location, generation) {
    if (!client || !state.user || !state.coupleId || !state.sharing || generation !== state.generation) return;
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const row = {
        user_id: state.user.id,
        couple_id: state.coupleId,
        latitude,
        longitude,
        accuracy_m: Number.isFinite(Number(location.accuracy)) ? Number(location.accuracy) : null,
        sharing: true,
        updated_at: new Date().toISOString()
    };
    const { data, error } = await client.from("location_shares")
        .upsert(row, { onConflict: "user_id" })
        .select("user_id, latitude, longitude, accuracy_m, sharing, updated_at")
        .single();
    if (error) {
        setStatus("Sharing is on, but the latest location could not sync. Check your connection.");
        return;
    }
    state.ownLocation = data;
    state.sharing = true;
    if (mapUpdated) mapUpdated.textContent = "Your location is sharing securely with your partner.";
    updateSharePresentation();
}

async function requestLocationPermission() {
    const current = await BackgroundGeolocation.checkPermissions();
    if (platform === "ios") {
        if (current.location !== "granted") {
            await BackgroundGeolocation.requestPermissions({ permissions: ["location"] });
        }
        const afterForeground = await BackgroundGeolocation.checkPermissions();
        if (afterForeground.location !== "granted") throw new Error("Allow location access to start sharing.");
        if (afterForeground.backgroundLocation !== "granted" && afterForeground.backgroundLocation !== "always") {
            await BackgroundGeolocation.requestPermissions({ permissions: ["backgroundLocation"] });
        }
        const finalStatus = await BackgroundGeolocation.checkPermissions();
        if (finalStatus.location !== "granted" || !["granted", "always"].includes(finalStatus.backgroundLocation)) {
            throw new Error("To share in the background, allow Always location access in iPhone Settings.");
        }
        return;
    }

    if (platform === "android") {
        const requested = [];
        if (current.location !== "granted") requested.push("location");
        if (current.notification !== "granted") requested.push("notification");
        if (requested.length) await BackgroundGeolocation.requestPermissions({ permissions: requested });
        const finalStatus = await BackgroundGeolocation.checkPermissions();
        if (finalStatus.location !== "granted") throw new Error("Allow location access to start sharing.");
        if (finalStatus.notification === "denied") throw new Error("Allow the tracking notification so Android can keep sharing in the background.");
        return;
    }

    const result = await BackgroundGeolocation.requestPermissions({ permissions: ["location"] });
    if (result.location !== "granted") throw new Error("Allow location access in your browser to share.");
}

async function startTracking({ requestPermissions = true } = {}) {
    if (state.tracking || !state.user || !state.coupleId || !state.partnerId) return;
    if (requestPermissions) await requestLocationPermission();
    else if (isNative) {
        const permissions = await BackgroundGeolocation.checkPermissions();
        const locationAllowed = permissions.location === "granted";
        const backgroundAllowed = platform !== "ios"
            || ["granted", "always"].includes(permissions.backgroundLocation);
        if (!locationAllowed || !backgroundAllowed) {
            throw new Error("Sharing is still on, but location permission needs attention in device Settings.");
        }
    }
    const generation = ++state.generation;
    state.tracking = true;
    updateSharePresentation();
    setStatus("Starting location sharing…");
    try {
        await BackgroundGeolocation.start({
            requestPermissions: false,
            backgroundTitle: "Our Love Story",
            backgroundMessage: "Location sharing is on. Tap to return to the app.",
            stale: false,
            distanceFilter: 50,
            minIntervalMs: 60000,
            networkFallback: true
        }, (location, error) => {
            if (error) {
                if (generation === state.generation) setStatus("Location is temporarily unavailable. Check device location settings.");
                return;
            }
            if (location) void saveLocation(location, generation);
        });
        if (!state.sharing) setStatus("Waiting for the first GPS fix…");
    } catch (error) {
        state.tracking = false;
        state.generation += 1;
        updateSharePresentation();
        throw error;
    }
}

async function startSharing() {
    if (!state.user) {
        const dialog = document.getElementById("settingsDialog");
        if (dialog && !dialog.open) dialog.showModal();
        setStatus("Sign in with your couple account first.");
        return;
    }
    if (!state.coupleId || !state.partnerId) {
        setStatus("The two accounts are not linked yet.");
        return;
    }
    state.busy = true;
    setButtons();
    try {
        await startTracking({ requestPermissions: true });
    } catch (error) {
        state.sharing = false;
        setStatus(error?.message || "Could not start location sharing.");
        updateSharePresentation();
    } finally {
        state.busy = false;
        setButtons();
    }
}

async function stopSharing({ silent = false } = {}) {
    state.busy = true;
    state.generation += 1;
    state.tracking = false;
    try { await BackgroundGeolocation.stop(); } catch (_) {}

    let updateError = null;
    if (client && state.user && state.ownLocation) {
        const { data, error } = await client.from("location_shares")
            .update({ sharing: false, updated_at: new Date().toISOString() })
            .eq("user_id", state.user.id)
            .select("user_id, latitude, longitude, accuracy_m, sharing, updated_at")
            .maybeSingle();
        updateError = error;
        if (!error) state.ownLocation = data;
    }
    state.sharing = false;
    state.busy = false;
    if (updateError) setStatus("GPS stopped, but the server could not confirm the off switch. Reopen the app when online.");
    else if (!silent) setStatus("Location sharing is off.");
    await loadPairAndLocations();
}

async function toggleSharing() {
    if (state.busy) return;
    if (state.sharing || state.tracking) await stopSharing();
    else await startSharing();
}

async function handleAuthChange(session) {
    const nextUser = session?.user || null;
    if (state.user?.id && state.user.id !== nextUser?.id && state.tracking) {
        state.generation += 1;
        state.tracking = false;
        try { await BackgroundGeolocation.stop(); } catch (_) {}
    }
    state.user = nextUser;
    if (!state.user) {
        state.coupleId = null;
        state.partnerId = null;
        state.ownLocation = null;
        state.partnerLocation = null;
        state.sharing = false;
        setStatus("Sign in with your couple account to use live location.");
        updateSharePresentation();
        return;
    }
    await loadPairAndLocations();
}

for (const button of buttonElements) button.addEventListener("click", toggleSharing);
document.querySelector('[data-page="world"]')?.addEventListener("click", () => { void loadPairAndLocations(); });
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void loadPairAndLocations();
});
window.stopCoupleLocationSharing = stopSharing;

if (client) {
    client.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(() => { void handleAuthChange(session); }, 0);
    });
    client.auth.getSession().then(({ data }) => handleAuthChange(data?.session || null));
} else {
    setStatus("Supabase is not available in this build.");
    updateSharePresentation();
}

state.refreshTimer = window.setInterval(() => {
    if (state.user && document.visibilityState === "visible") void loadPairAndLocations();
}, 30000);
