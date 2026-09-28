import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { BGM_KEY, BGM_TRACKS, SOUND_KEY, setBackgroundMusic, stopBackgroundMusic } from "../services/presentation/preferences";

function trackForPath(pathname: string): string {
  return /^\/(?:game|room|phong|spectate)\//.test(pathname) ? BGM_TRACKS.match : BGM_TRACKS.lobby;
}

/** Arms optional music only after a real user gesture; route changes crossfade tracks. */
export function PresentationAudio() {
  const { pathname } = useLocation();
  const armed = useRef(false);
  useEffect(() => {
    const sync = () => {
      if (!armed.current) return;
      if (localStorage.getItem(SOUND_KEY) === "off" || localStorage.getItem(BGM_KEY) !== "on") stopBackgroundMusic();
      else setBackgroundMusic(trackForPath(pathname));
    };
    const arm = () => { armed.current = true; sync(); };
    const onPreferenceChange = () => sync();
    window.addEventListener("pointerdown", arm, { once: true, passive: true });
    window.addEventListener("keydown", arm, { once: true });
    window.addEventListener("touchstart", arm, { once: true, passive: true });
    window.addEventListener("ottv2:audio-preferences", onPreferenceChange);
    sync();
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      window.removeEventListener("touchstart", arm);
      window.removeEventListener("ottv2:audio-preferences", onPreferenceChange);
    };
  }, [pathname]);
  useEffect(() => () => stopBackgroundMusic(), []);
  return null;
}
