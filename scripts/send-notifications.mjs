import admin from "firebase-admin";
import webpush from "web-push";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!serviceAccount.project_id) throw new Error("FIREBASE_SERVICE_ACCOUNT secret eksik veya hatali.");

const publicKey = process.env.WEB_PUSH_PUBLIC_KEY || "";
const privateKey = process.env.WEB_PUSH_PRIVATE_KEY || "";
if (!publicKey || !privateKey) throw new Error("WEB_PUSH_PUBLIC_KEY veya WEB_PUSH_PRIVATE_KEY secret eksik.");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
webpush.setVapidDetails("mailto:admin@example.com", publicKey, privateKey);

const db = admin.firestore();
const siteUrl = process.env.SITE_URL || "https://ktoshmyo1-web.github.io/amh-duyuru/";

const announcementsSnap = await db.collection("announcements").where("pushSent", "==", false).get();
const subscriptionsSnap = await db.collection("pushSubscriptions").get();
const subscriptions = subscriptionsSnap.docs
  .map((doc) => ({ id: doc.id, ...doc.data() }))
  .filter((item) => item.subscription?.endpoint);

if (announcementsSnap.empty) {
  console.log("Gonderilecek yeni duyuru yok.");
  process.exit(0);
}

for (const announcementDoc of announcementsSnap.docs) {
  const announcement = announcementDoc.data();
  const title = announcement.title || "Yeni duyuru";
  const body = announcement.body || "AMH Ogrenci Portali'nda yeni duyuru var.";
  const targetClass = announcement.targetClass || "all";
  const targets = subscriptions.filter((item) => targetClass === "all" || item.classYear === targetClass);

  if (!targets.length) {
    await announcementDoc.ref.update({ pushSent: true, pushSentAt: Date.now(), pushResult: "Abonelik yok" });
    console.log(`${title}: Abonelik yok.`);
    continue;
  }

  let successCount = 0;
  let failureCount = 0;
  await Promise.all(targets.map(async (target) => {
    try {
      await webpush.sendNotification(target.subscription, JSON.stringify({
        title,
        body: body.slice(0, 180),
        url: siteUrl
      }));
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      if (error.statusCode === 404 || error.statusCode === 410) {
        await db.collection("pushSubscriptions").doc(target.id).delete();
      }
      console.error(`${target.schoolNo || target.id}: ${error.statusCode || ""} ${error.message}`);
    }
  }));

  await announcementDoc.ref.update({
    pushSent: true,
    pushSentAt: Date.now(),
    pushResult: `${successCount} basarili, ${failureCount} hatali`
  });
  await db.collection("auditLogs").add({
    action: "Push bildirim gonderildi",
    actorId: "github-actions",
    actorName: "GitHub Actions",
    detail: `${title} | ${successCount} basarili, ${failureCount} hatali`,
    createdAt: Date.now()
  });
  console.log(`${title}: ${successCount} basarili, ${failureCount} hatali`);
}
