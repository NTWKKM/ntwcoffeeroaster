// This is a conceptual example of a backend server file.
// It cannot be run in this environment and is for educational purposes only.

// You would need to install these libraries on your server.
// const express = require('express');
// const stripe = require('stripe')('YOUR_STRIPE_SECRET_KEY'); // <-- This key MUST be kept secret!
// const app = express();
// app.use(express.json());

// This is the endpoint that your frontend will call to initiate a payment.
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount } = req.body;

    // 1. Create a PaymentIntent with the Stripe API
    // The amount must be in the smallest currency unit (e.g., cents)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'thb',
    });

    // 2. Send the client secret back to the frontend
    // The frontend uses this key to securely complete the payment.
    res.json({
      clientSecret: paymentIntent.client_secret,
    });
    
  } catch (error) {
    // Handle errors and send an appropriate response
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent.' });
  }
});

// A webhook endpoint to handle post-payment events
// Stripe will send a notification here after a payment is successful.
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const payload = req.body;
  const sig = req.headers['stripe-signature'];
  
  let event;

  try {
    // 3. Verify the webhook signature to ensure it's from Stripe
    event = stripe.webhooks.constructEvent(payload, sig, 'YOUR_STRIPE_WEBHOOK_SECRET');
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
      // 4. Update your database and fulfill the order here (e.g., in Firestore)
      // Example: await updateOrderStatusInFirestore(paymentIntent.id, 'completed');
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).end();
});

// Example of how the server would start.
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
