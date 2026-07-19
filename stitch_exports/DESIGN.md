EugineBill Customer Portal - UI/UX Design Prompt for Stitch
Project Context: You are designing the "Customer Portal" for a modern Internet Service Provider (ISP) billing and management system named EugineBill. The end-users are residential internet subscribers who log in via their mobile phones or desktop browsers. The design should focus on clarity, ease of use, and enterprise-grade professionalism.
Design Guidelines:


Aesthetic Structure: Use the "Hallmark" design philosophy. Focus on clean, structured macrostructures (like Bento Grids and hairline tables), high information density for data points, and clear typography hierarchy.

Constraints: Do NOT apply specific colors, fonts, or highly stylized aesthetic tokens. Focus purely on layout, spacing, structural composition, and user flow. Let the underlying design system handle the final palette and typography.
Screen 1: Main Dashboard (Route: /customer)
Purpose: The central hub where users see their internet status at a glance and access quick actions. Data & Components Needed:


Hero/Header Section:


Customer Name and Customer ID.

Connection Status Badge: "Aktif" (Active) or "Terisolir" (Isolated).

Subscription Tier info: Package Name (e.g., "Paket 30Mbps") and Speed.

Expiry Date / Time To Live (TTL): Showing the exact date and a badge indicating days left (e.g., "Tersisa 5 Hari" or "Kedaluwarsa Hari Ini").

Command Palette / Quick Actions (Grid of 4 buttons):


"Tagihan" (Link to Invoices)

"Pengaturan Wi-Fi" (Link to Router settings)

"Pusat Bantuan" (Link to Tickets)

"Profil Akun" (Link to Profile)

Pending Actions Area:


If there are unpaid invoices, show a highlighted card summarizing the invoice number, due date, amount, and a prominent "Bayar Sekarang" (Pay Now) CTA.

Recent Transaction Logs:


A compact list/table showing the last 3-5 invoices with their Date, Amount, and Status (Lunas/Menunggu).
Screen 2: Invoice Management (Route: /customer/invoices)
Purpose: Where users view all their billing statements. Data & Components Needed:


Status Filters (Tabs/Pills): "Semua" (All), "Belum Bayar" (Unpaid), "Jatuh Tempo" (Overdue), "Lunas" (Paid).

Invoice List/Grid:


Each invoice card/row must display: Invoice Number, Due Date, Total Amount, and Status.

Action Button: If unpaid, show a "Bayar Sekarang" button. If the payment link hasn't been generated yet, show a "Buat Link" (Generate Link) button.
Screen 3: Payment Page (Route: /pay/[token])
Purpose: A public-facing checkout page where the actual transaction happens. Data & Components Needed:


Invoice Summary Card: Company Name, Customer Name, Invoice Number, Due Date, and Total Amount.

Payment Methods Section:


Option 1: Payment Gateway (e.g., Midtrans/Tripay) - showing logos of virtual accounts or e-wallets.

Option 2: Manual Transfer - showing bank account details (Bank Name, Account Number, Account Holder Name).

File Upload Input: For users to upload their proof of manual transfer.

Support CTA: A button to contact admin via WhatsApp if they need help.
Screen 4: Helpdesk / Ticketing (Route: /customer/tickets)
Purpose: Where users report internet issues and track resolution progress. Data & Components Needed:


Ticket List View (/customer/tickets):


Search bar and Status filter (Open, In Progress, Resolved).

"Buat Tiket Baru" (Create New Ticket) Floating Action Button or primary CTA.

List of tickets showing: Ticket Subject, Category, Date, Status Badge, and the last update time.

Ticket Creation Form (/customer/tickets/create):


Form fields: Subject (Text Input), Category (Dropdown), Description (Textarea).

Location Input: A field for address with a button "Dapatkan Lokasi" (Get GPS Location).

File Upload: To attach images of error messages or broken cables.

Ticket Detail / Chat View (/customer/tickets/[id]):


Header showing Ticket Subject and Status.

A chat-like interface displaying a chronological thread of messages between the Customer, Admin, and System.

A text input area at the bottom to send a reply.
Screen 5: Profile Settings (Route: /customer/profile)
Purpose: For managing personal credentials. Data & Components Needed:


Profile Header: Avatar icon, Name, and Role.

Personal Information Form:


Fields: Name, Email, Phone Number.

Note: Changing the phone number requires an OTP, so there should be an inline input for OTP Code and a "Kirim OTP" button next to the phone field.

Security Section:


Form to update password: "Password Baru" and "Ulangi Password" with an "Ubah Password" CTA.