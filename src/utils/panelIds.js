// ============================================================
// DIFUSED TIERS — shared custom IDs for the evaluation testing
// waitlist panel (button, select menu, modals).
// ============================================================

const REGISTER_BUTTON_ID = "dt_register_profile";
const REGISTER_MODAL_ID = "dt_register_modal";
const REGISTER_MODAL_IGN_INPUT = "dt_register_ign";

const WAITLIST_SELECT_ID = "dt_join_waitlist";
const WAITLIST_MODAL_PREFIX = "dt_waitlist_modal_"; // + gamemode key
const WAITLIST_MODAL_REGION_INPUT = "dt_waitlist_region";
const WAITLIST_MODAL_USERNAME_INPUT = "dt_waitlist_username";

// ---- /setup queue per-gamemode open/closed queue panels ----
const QUEUE_JOIN_PREFIX = "dt_queue_join_"; // + gamemode key
const QUEUE_LEAVE_PREFIX = "dt_queue_leave_"; // + gamemode key

// ---- /pull ticket channel ----
const TICKET_CLOSE_BUTTON_ID = "dt_ticket_close";

// ---- /setup application panel (Staff / Tester applications) ----
const APPLICATION_SELECT_ID = "dt_application_select";
const APPLICATION_TYPE_STAFF = "staff";
const APPLICATION_TYPE_TESTER = "tester";
const APPLICATION_ACCEPT_PREFIX = "dt_app_accept_"; // + application id
const APPLICATION_DENY_PREFIX = "dt_app_deny_"; // + application id

module.exports = {
  REGISTER_BUTTON_ID,
  REGISTER_MODAL_ID,
  REGISTER_MODAL_IGN_INPUT,
  WAITLIST_SELECT_ID,
  WAITLIST_MODAL_PREFIX,
  WAITLIST_MODAL_REGION_INPUT,
  WAITLIST_MODAL_USERNAME_INPUT,
  QUEUE_JOIN_PREFIX,
  QUEUE_LEAVE_PREFIX,
  TICKET_CLOSE_BUTTON_ID,
  APPLICATION_SELECT_ID,
  APPLICATION_TYPE_STAFF,
  APPLICATION_TYPE_TESTER,
  APPLICATION_ACCEPT_PREFIX,
  APPLICATION_DENY_PREFIX,
};
