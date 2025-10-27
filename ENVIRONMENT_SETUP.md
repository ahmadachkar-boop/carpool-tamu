# Environment Variables Setup

This project uses environment variables to keep sensitive configuration secure.

## Quick Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Add your keys to `.env`:**
   ```env
   REACT_APP_VAPID_KEY=your_vapid_key_from_firebase_console
   ```

3. **Restart your development server:**
   ```bash
   npm start
   ```

---

## Environment Variables

### REACT_APP_VAPID_KEY

**What it is:** Firebase Cloud Messaging VAPID key for web push notifications

**Where to get it:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings > Cloud Messaging
4. Under "Web Push certificates", click "Generate key pair"
5. Copy the key (starts with "B...")

**How to use it:**
```env
# .env
REACT_APP_VAPID_KEY=BNdP9kXYZ1234567890abcdefghijklmnopqrstuvwxyz...
```

---

## Security Best Practices

### ✅ DO:
- Copy `.env.example` to `.env` for your local development
- Add all sensitive keys to `.env`
- Set environment variables in your hosting platform for production
- Keep `.env` out of version control (already in `.gitignore`)

### ❌ DON'T:
- Commit `.env` to git
- Share your `.env` file with others
- Hardcode sensitive keys in source code
- Use production keys in development

---

## Production Deployment

When deploying to production, set environment variables in your hosting platform:

### Firebase Hosting
```bash
firebase functions:config:set fcm.vapid_key="your_key_here"
```

### Vercel
Go to Project Settings > Environment Variables > Add New

### Netlify
Go to Site Settings > Build & Deploy > Environment > Edit Variables

### Custom Server
Set environment variables in your server's configuration or use a process manager like PM2.

---

## Adding New Environment Variables

1. Add to `.env.example` (without the actual value):
   ```env
   REACT_APP_NEW_KEY=your_new_key_here
   ```

2. Add to your local `.env` (with the actual value):
   ```env
   REACT_APP_NEW_KEY=actual_value_123
   ```

3. Update this documentation

4. Use in code:
   ```javascript
   const myKey = process.env.REACT_APP_NEW_KEY;
   ```

**Note:** All React environment variables must start with `REACT_APP_` to be accessible in the frontend.

---

## Troubleshooting

### Variables not working?

1. **Restart the dev server** - Environment variables are loaded at startup
   ```bash
   # Stop server (Ctrl+C)
   npm start
   ```

2. **Check variable name** - Must start with `REACT_APP_`
   ```javascript
   // ✅ Correct
   REACT_APP_MY_KEY=value

   // ❌ Wrong - won't be accessible
   MY_KEY=value
   ```

3. **Check .env location** - Must be in project root (same folder as package.json)

4. **No quotes needed** - Unless your value has spaces
   ```env
   # ✅ Correct
   REACT_APP_KEY=abc123

   # ✅ Also correct (if value has spaces)
   REACT_APP_KEY="abc 123"
   ```

5. **Verify file is named correctly** - Must be exactly `.env` (with the dot)

---

## More Information

- [Create React App Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/)
- [FCM_APNS_SETUP.md](./FCM_APNS_SETUP.md) - Firebase setup guide
- [CLOUD_FUNCTIONS_DEPLOY.md](./CLOUD_FUNCTIONS_DEPLOY.md) - Cloud Functions guide
