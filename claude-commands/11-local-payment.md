Add Moroccan local payment methods. Most Moroccan students cannot use Stripe (requires international card).

The primary target is CMI (Centre Monétique Interbancaire) which covers CIH, Attijariwafa, BMCE, Banque Populaire, and Barid Bank cards.

Backend steps:
1. Create app/services/payment_service_cmi.py:
   - CMI uses a redirect-based payment flow
   - initiate_payment(amount, currency='MAD', order_id, return_url, cancel_url) → returns redirect URL
   - verify_callback(params: dict) → validates HMAC signature from CMI callback
   - CMI sandbox credentials in .env: CMI_MERCHANT_ID, CMI_STORE_KEY, CMI_API_URL

2. Add POST /api/v1/me/subscribe-cmi:
   - Creates a pending subscription record
   - Calls CMI initiate_payment
   - Returns {redirect_url}

3. Add POST /api/v1/webhooks/cmi:
   - Receives CMI payment callback with HMAC params
   - Validates HMAC signature using store key
   - On success: activate subscription (same logic as Stripe webhook handler)
   - Returns "ACTION=POSTAUTH" (required by CMI protocol)

4. Add 'cmi' as a payment_method option in the subscriptions table

Frontend steps:
5. In /pricing page:
   - Show "Payer par carte marocaine (CMI)" button alongside Stripe
   - On click: call /me/subscribe-cmi, redirect to CMI payment page
   - On return from CMI: show success/failure based on URL params
6. Show "Carte Marocaine" with bank logos (CIH, Attijariwafa, BMCE) for Moroccan users

Show complete CMI service, webhook handler, and pricing page payment options.
