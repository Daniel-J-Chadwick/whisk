import { NavLink } from "react-router-dom";
import { classNames } from "../lib/utils";
import { useKeyboard } from "../hooks/useKeyboard";
import { BookOpen, Globe, Sparkles, ShoppingCart, CalendarDays, Cog, WhiskLogo } from "./ui/Icon";

const tabs = [
  { to: "/discover", icon: Globe, label: "Discover" },
  { to: "/", icon: BookOpen, label: "Recipes" },
  { to: "/ask", icon: Sparkles, label: "Ask", center: true as const },
  { to: "/plan", icon: CalendarDays, label: "Plan" },
  { to: "/list", icon: ShoppingCart, label: "List" },
];

/**
 * Bottom tab bar on phones and tablets; a fixed left sidebar (w-56) from the
 * `lg` breakpoint up. App.tsx offsets the page with `lg:pl-56` to match.
 */
export function BottomNav() {
  const { isKeyboardOpen } = useKeyboard();
  return (
    <nav className={classNames(
      "no-print fixed bottom-0 inset-x-0 z-40 transition-transform duration-200",
      "lg:top-0 lg:right-auto lg:w-56 lg:translate-y-0",
      isKeyboardOpen && "translate-y-full"
    )}>
      <div className={classNames(
        "max-w-6xl mx-auto border-t border-stone-200 bg-white/95 backdrop-blur-sm dark:border-orange-500/10 dark:bg-stone-950/95 pb-[var(--sab)]",
        "lg:h-full lg:max-w-none lg:mx-0 lg:border-t-0 lg:border-r lg:flex lg:flex-col lg:px-3 lg:py-5"
      )}>
        <div className="hidden lg:flex items-center gap-2 px-3 pb-6 text-stone-900 dark:text-stone-100">
          <WhiskLogo className="w-7 h-7 text-orange-500" />
          <span className="text-lg font-semibold">Whisk</span>
        </div>
        <div className="flex items-center lg:flex-col lg:items-stretch lg:gap-1">
          {tabs.map((tab) => {
            const isCenter = "center" in tab && tab.center;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === "/"}
                className="flex-1 min-w-0 lg:flex-none"
              >
                {({ isActive }) => (
                  <div className={classNames(
                    "flex flex-col items-center text-xs font-medium transition-colors",
                    "lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm lg:rounded-lg",
                    isCenter ? "gap-0 py-1" : "gap-0.5 py-2",
                    isActive
                      ? "text-orange-500 lg:bg-orange-500/10"
                      : "text-stone-500 dark:text-stone-400 lg:hover:bg-stone-100 lg:hover:text-stone-900 dark:lg:hover:bg-stone-800 dark:lg:hover:text-stone-100"
                  )}>
                    {isCenter ? (
                      <>
                        <span className={classNames(
                          "flex items-center justify-center w-10 h-10 -mt-3 rounded-full shadow-md transition-colors lg:hidden",
                          isActive
                            ? "bg-orange-500 text-white shadow-orange-500/20"
                            : "bg-stone-200 text-stone-500 shadow-stone-200/20 dark:bg-stone-700 dark:text-stone-400 dark:shadow-stone-700/20"
                        )}>
                          <tab.icon className="w-5 h-5" />
                        </span>
                        <tab.icon className="hidden lg:block w-5 h-5" />
                      </>
                    ) : (
                      <tab.icon className="w-6 h-6 lg:w-5 lg:h-5" />
                    )}
                    <span>{tab.label}</span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>
        <NavLink to="/settings" className="hidden lg:block mt-auto">
          {({ isActive }) => (
            <div className={classNames(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "text-orange-500 bg-orange-500/10"
                : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            )}>
              <Cog className="w-5 h-5" />
              <span>Settings</span>
            </div>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
