(() => {
  const installed = Symbol.for("x360.audio");
  const MAP = {
    "deck_ui_achievement_toast.wav": "nxe_unlock.wav",
    "deck_ui_navigation.wav": "x360_focus.wav",
    "deck_ui_tile_scroll.wav": "x360_focus.wav",
    "deck_ui_misc_10.wav": "x360_focus.wav",
    "deck_ui_default_activation.wav": "x360_select.wav",
    "deck_ui_misc_01.wav": "x360_select.wav",
    "deck_ui_misc_08.wav": "x360_select.wav",
    "deck_ui_switch_toggle_on.wav": "x360_select.wav",
    "deck_ui_switch_toggle_off.wav": "x360_select.wav",
    "confirmation_positive.wav": "x360_select.wav",
    "confirmation_negative.wav": "x360_back.wav",
    "deck_ui_hide_modal.wav": "silence.wav",
    "deck_ui_show_modal.wav": "silence.wav",
    "deck_ui_into_game_detail.wav": "silence.wav",
    "deck_ui_out_of_game_detail.wav": "silence.wav",
    "deck_ui_launch_game.wav": "silence.wav",
    "deck_ui_tab_transition_01.wav": "silence.wav",
    "deck_ui_side_menu_fly_in.wav": "x360_guide_open.wav",
    "deck_ui_side_menu_fly_out.wav": "x360_guide_close.wav",
    "deck_ui_toast.wav": "x360_notify.wav",
    "deck_ui_message_toast.wav": "x360_notify.wav",
    "desktop_toast_default.wav": "x360_notify.wav",
    "desktop_toast_short.wav": "x360_notify.wav",
    "deck_ui_typing.wav": "x360_key.wav",
    "deck_ui_slider_up.wav": "x360_inactive.wav",
    "deck_ui_slider_down.wav": "x360_inactive.wav",
    "deck_ui_volume.wav": "x360_inactive.wav",
    "deck_ui_bumper_end_02.wav": "x360_inactive.wav",
    "bumper_end.wav": "x360_inactive.wav",
  };
  function install() {
    let store = window.SteamUIStore;
    try { store ||= window.opener?.SteamUIStore; } catch {  }
    const manager = store?.GamepadUIAudio?.AudioPlaybackManager;
    if (!manager || typeof manager.PlayAudioURL !== "function") return false;
    if (manager[installed]) return true;
    const play = manager.PlayAudioURL;
    manager.PlayAudioURL = function (url, ...options) {
      if (typeof url === "string") {
        const [path, query] = url.split("?");
        const slash = path.lastIndexOf("/");
        const swap = MAP[path.slice(slash + 1)];
        if (swap) url = path.slice(0, slash + 1) + swap + (query ? "?" + query : "");
      }
      return play.call(this, url, ...options);
    };
    manager[installed] = true;
    return true;
  }
  if (!install()) {
    let attempts = 0;
    const timer = setInterval(() => {
      if (install() || ++attempts >= 120) clearInterval(timer);
    }, 500);
  }
})();
