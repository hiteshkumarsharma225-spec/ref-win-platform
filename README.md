# Playground Royale

Build a mobile-first gaming battle and tournament platform inspired by FunBattle (funbattle.in) with complete game lobby, wallet, and referral features:

1. **Brand & Mobile-First UI**:
   - Modern dark theme gaming aesthetic (gold/yellow and neon accent colors, sleek cards, bottom navigation bar for mobile).
   - Responsive layout optimized for mobile screens (app-like feel with header, status bar, and bottom tabs).

2. **Authentication & Referral System**:
   - Phone number login/signup with real SMS OTP verification (Twilio Verify or the configured Lovable SMS gateway).
   - Referral tracking supporting invite links with referral codes (e.g., `?refer=080545`).
   - Referral dashboard: user's personal referral link, share buttons, earnings history, and commission tiers.

3. **Battle / Match Lobby (Ludo / Esports Skill Gaming)**:
   - "Create Battle" modal: select game (Ludo Classic, Ludo Popular, Quick Ludo), enter battle amount (e.g. ₹50, ₹100, ₹250, ₹500, ₹1000) with calculated winning prize.
   - "Open Battles" list: live challenges waiting for an opponent with an "Accept" button.
   - "Running Battles" list: active matches.
   - Battle Room screen:
     - Room Code sharing / copy button (for entering in Ludo King / game app).
     - Live timer and match status (Waiting for code, Match in progress, Result pending).
     - Match Result submission: buttons for "I Won", "I Lost", "Cancel", with screenshot upload for win verification.
     - Dispute / penalty rules warning.

4. **Wallet & Payment Flow**:
   - Balance breakdown: Deposit Cash, Winning Cash, Bonus Cash.
   - Add Money (Deposit): preset amounts (₹50, ₹100, ₹200, ₹500, etc.), UPI payment instructions / simulated gateway or manual UPI QR pay.
   - Withdraw Money: enter amount, UPI ID or bank account details, minimum withdrawal limit checks, and status tracking (Pending, Approved, Completed).
   - Transaction History: filtered by All, Deposits, Withdrawals, Game Bets, and Winnings.

5. **KYC & Profile**:
   - User profile with avatar, username, mobile number, total battles won/lost, win rate.
   - KYC Verification screen for ID proof submission (Aadhaar / PAN simulation) required for withdrawals.
   - Rules & Fair Play guidelines, Terms & Conditions, and WhatsApp/Telegram customer support buttons.

6. **Admin / Moderator Controls**:
   - Toggle to access admin mode to manage battle disputes, approve/reject withdrawals, and view platform metrics.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ref-win-platform.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4e5a1d3c-62b3-49c7-b730-ed84445c287e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
