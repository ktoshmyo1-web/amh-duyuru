import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!serviceAccount.project_id) throw new Error("FIREBASE_SERVICE_ACCOUNT secret eksik veya hatali.");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const messaging = admin.messaging();
const siteUrl = process.env.SITE_URL || "https://ktoshmyo1-web.github.io/amh-portal/";

const announcementsSnap = await db.collection("announcements").where("pushSent", "==", false).get();
const tokensSnap = await db.collection("notificationTokens").get();
const tokens = tokensSnap.docs.map((doc) => doc.id).filter(Boolean);

if (announcementsSnap.empty) {
  console.log("Gonderilecek yeni duyuru yok.");
  process.exit(0);
}

for (const announcementDoc of announcementsSnap.docs) {
  const announcement = announcementDoc.data();
  const title = announcement.title || "Yeni duyuru";
  const body = announcement.body || "AMH Öğrenci Portalı'nda yeni duyuru var.";

  if (!tokens.length) {
    await announcementDoc.ref.update({ pushSent: true, pushSentAt: Date.now(), pushResult: "Token yok" });
    console.log(`${title}: Token yok.`);
    continue;
  }

  let successCount = 0;
  let failureCount = 0;
  for (const tokenChunk of chunk(tokens, 500)) {
    const response = await messaging.sendEachForMulticast({
      tokens: tokenChunk,
      notification: { title, body: body.slice(0, 180) },
      webpush: {
        fcmOptions: { link: siteUrl },
        notification: {
          icon: `${siteUrl.replace(/\/$/, "")}/icon.svg`,
          badge: `${siteUrl.replace(/\/$/, "")}/icon.svg`
        }
      },
      data: { title, body: body.slice(0, 500), url: siteUrl }
    });
    successCount += response.successCount;
    failureCount += response.failureCount;
    await Promise.all(response.responses.map(async (result, index) => {
      if (result.success) return;
      const code = result.error?.code || "";
      if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
        await db.collection("notificationTokens").doc(tokenChunk[index]).delete();
      }
    }));
  }

  await announcementDoc.ref.update({
    pushSent: true,
    pushSentAt: Date.now(),
    pushResult: `${successCount} basarili, ${failureCount} hatali`
  });
  await db.collection("auditLogs").add({
    action: "Push bildirim gönderildi",
    actorId: "github-actions",
    actorName: "GitHub Actions",
    detail: `${title} | ${successCount} basarili, ${failureCount} hatali`,
    createdAt: Date.now()
  });
  console.log(`${title}: ${successCount} basarili, ${failureCount} hatali`);
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
