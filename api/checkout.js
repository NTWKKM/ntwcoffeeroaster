// api/checkout.js

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ตรวจสอบว่า Firebase Admin SDK ถูกเริ่มต้นแล้วหรือยัง
let app;
try {
  app = initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
} catch (error) {
  app = getApp();
}

const db = getFirestore(app);

export default async function handler(req, res) {
  // ตรวจสอบว่าเป็นคำขอแบบ POST หรือไม่
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { cart, fullName, address, userId } = req.body;

  // ตรวจสอบข้อมูลที่ได้รับ
  if (!cart || !fullName || !address || !userId) {
    return res.status(400).json({ message: 'Missing required data' });
  }

  try {
    // ใช้ Firestore Transaction เพื่อจัดการสต็อกและคำสั่งซื้ออย่างปลอดภัย
    const result = await db.runTransaction(async (t) => {
      const productRefs = Object.keys(cart).map(productId => db.collection('products').doc(productId));
      const productDocs = await t.getAll(...productRefs);

      const items = [];
      let totalAmount = 0;

      for (const doc of productDocs) {
        const cartItem = cart[doc.id];
        const productData = doc.data();

        // ตรวจสอบว่าสินค้ามีอยู่และสต็อกพอหรือไม่
        if (!doc.exists || productData.stock < cartItem.quantity) {
          throw new Error(`สต็อกสำหรับสินค้า ${productData.name} ไม่พอ`);
        }

        // หักสต็อก
        const newStock = productData.stock - cartItem.quantity;
        t.update(doc.ref, { stock: newStock });

        // สร้างรายการสินค้าสำหรับคำสั่งซื้อ
        items.push({
          productId: doc.id,
          name: productData.name,
          price: productData.price,
          quantity: cartItem.quantity
        });
        totalAmount += productData.price * cartItem.quantity;
      }

      // สร้างเอกสารคำสั่งซื้อใหม่
      const orderRef = db.collection('orders').doc();
      t.set(orderRef, {
        userId,
        items,
        totalAmount,
        address,
        fullName,
        createdAt: FieldValue.serverTimestamp(),
        status: 'paid'
      });

      return { success: true, orderId: orderRef.id };
    });

    res.status(200).json({ success: true, message: 'Order created successfully!', orderId: result.orderId });
  } catch (e) {
    console.error('Transaction failed:', e);
    res.status(500).json({ success: false, message: e.message || 'An unexpected error occurred.' });
  }
}
