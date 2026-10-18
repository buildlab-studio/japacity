// The service worker of the bank-full notice (clock:full-bank-push-notification):
// shows what the server pushed, one notice at a time under its tag, and opens
// the game when it is tapped. Nothing else: no cache, no fetch handler.
// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/push_event
const worker = globalThis;

worker.addEventListener("push", (event) => {
  let notice = { title: "Japacity", body: "", tag: "notify" };
  try {
    notice = { ...notice, ...event.data.json() };
  } catch {
    // A push with no readable words still shows the game's name.
  }
  event.waitUntil(worker.registration.showNotification(notice.title, { body: notice.body, tag: notice.tag }));
});

worker.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    worker.clients.matchAll({ type: "window", includeUncontrolled: true }).then((open) => {
      const tab = open.find((each) => "focus" in each);
      return tab === undefined ? worker.clients.openWindow("/") : tab.focus();
    }),
  );
});
