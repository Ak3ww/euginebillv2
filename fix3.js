const fs = require('fs');
let t = fs.readFileSync('src/app/customer/CustomerClientLayout.tsx', 'utf8');
const oldReturnIdx = t.indexOf('  return (\n    <div className={cn("min-h-screen font-body');
const endIdx = t.indexOf('\n// ─── Bridge for global');
if (oldReturnIdx !== -1 && endIdx !== -1) {
  const stitchedLayout = `  return (
    <div className="text-on-surface bg-background pb-[80px] min-h-screen flex flex-col">
      <header className="w-full top-0 sticky bg-surface-bright dark:bg-surface-dim border-b border-hairline-border dark:border-outline-variant z-40 transition-colors duration-200">
        <div className="flex justify-between items-center px-margin-mobile h-16 w-full max-w-container-max mx-auto">
          <div 
            className="flex items-center gap-4 hover:bg-surface-container-low dark:hover:bg-surface-container-high transition-colors duration-200 p-2 rounded cursor-pointer"
            onClick={() => router.push('/customer')}
          >
            <div className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden flex items-center justify-center">
              {companyLogo ? (
                <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined">home</span>
              )}
            </div>
            <h1 className="text-headline-md font-headline-md text-primary dark:text-primary-fixed-dim tracking-tight">
              {companyName || 'EugineBill'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="text-primary dark:text-primary-fixed-dim p-2 rounded-full hover:bg-surface-container-low dark:hover:bg-surface-container-high transition-colors duration-200 active:opacity-70">
              <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button className="text-primary dark:text-primary-fixed-dim p-2 rounded-full hover:bg-surface-container-low dark:hover:bg-surface-container-high transition-colors duration-200 active:opacity-70 relative">
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-status-isolated rounded-full"></span>
              )}
            </button>
          </div>
        </div>
      </header>

      {children}

      <nav className="fixed bottom-0 w-full z-50 bg-surface-container-lowest dark:bg-surface-container-highest border-t border-hairline-border dark:border-outline-variant md:hidden">
        <div className="fixed bottom-0 left-0 w-full flex justify-around items-center pt-2 pb-safe px-2 h-16">
          <button onClick={() => router.push('/customer')} className={\`flex flex-col items-center justify-center \${isActive('/customer') && pathname === '/customer' ? 'text-primary dark:text-secondary-fixed-dim font-bold' : 'text-on-surface-variant dark:text-outline'} active:scale-95 transition-transform duration-150 hover:bg-surface-container-low p-2 rounded-lg flex-1\`}>
            <span className="material-symbols-outlined" style={isActive('/customer') && pathname === '/customer' ? { fontVariationSettings: "'FILL' 1" } : undefined}>home</span>
            <span className="font-label-caps text-label-caps mt-1">Home</span>
          </button>
          <button onClick={() => router.push('/customer/invoices')} className={\`flex flex-col items-center justify-center \${isActive('/customer/invoices') || isActive('/customer/history') ? 'text-primary dark:text-secondary-fixed-dim font-bold' : 'text-on-surface-variant dark:text-outline'} active:scale-95 transition-transform duration-150 hover:bg-surface-container-low p-2 rounded-lg flex-1\`}>
            <span className="material-symbols-outlined" style={isActive('/customer/invoices') || isActive('/customer/history') ? { fontVariationSettings: "'FILL' 1" } : undefined}>receipt_long</span>
            <span className="font-label-caps text-label-caps mt-1">Invoices</span>
          </button>
          <button onClick={() => router.push('/customer/wifi')} className={\`flex flex-col items-center justify-center \${isActive('/customer/wifi') ? 'text-primary dark:text-secondary-fixed-dim font-bold' : 'text-on-surface-variant dark:text-outline'} active:scale-95 transition-transform duration-150 hover:bg-surface-container-low p-2 rounded-lg flex-1\`}>
            <span className="material-symbols-outlined" style={isActive('/customer/wifi') ? { fontVariationSettings: "'FILL' 1" } : undefined}>router</span>
            <span className="font-label-caps text-label-caps mt-1">WiFi</span>
          </button>
          <button onClick={() => router.push('/customer/tickets')} className={\`flex flex-col items-center justify-center \${isActive('/customer/tickets') ? 'text-primary dark:text-secondary-fixed-dim font-bold' : 'text-on-surface-variant dark:text-outline'} active:scale-95 transition-transform duration-150 hover:bg-surface-container-low p-2 rounded-lg flex-1\`}>
            <span className="material-symbols-outlined" style={isActive('/customer/tickets') ? { fontVariationSettings: "'FILL' 1" } : undefined}>contact_support</span>
            <span className="font-label-caps text-label-caps mt-1">Support</span>
          </button>
          <button onClick={() => router.push('/customer/profile')} className={\`flex flex-col items-center justify-center \${isActive('/customer/profile') ? 'text-primary dark:text-secondary-fixed-dim font-bold' : 'text-on-surface-variant dark:text-outline'} active:scale-95 transition-transform duration-150 hover:bg-surface-container-low p-2 rounded-lg flex-1\`}>
            <span className="material-symbols-outlined" style={isActive('/customer/profile') ? { fontVariationSettings: "'FILL' 1" } : undefined}>person</span>
            <span className="font-label-caps text-label-caps mt-1">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}`;
  t = t.substring(0, oldReturnIdx) + stitchedLayout + t.substring(endIdx);
  fs.writeFileSync('src/app/customer/CustomerClientLayout.tsx', t);
  console.log('Fixed CustomerClientLayout');
} else {
  console.log('Could not find indices', oldReturnIdx, endIdx);
}
