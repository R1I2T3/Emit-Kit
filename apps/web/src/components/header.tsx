import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between px-4 py-2">
        <Link to="/" className="flex items-center gap-2 group select-none">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-all duration-200">
            <Radio className="size-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-zinc-100 group-hover:text-white transition-colors duration-200">
            Emitkit
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
