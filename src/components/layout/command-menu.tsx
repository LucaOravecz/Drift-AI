"use client";

import * as React from "react";
import {
  Calendar,
  User,
  Search,
  Shield,
  FileText,
  MessageSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { globalSearch } from "@/lib/actions";

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<{ clients: any[]; prospects: any[] }>({ clients: [], prospects: [] });
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 1) {
        const searchResults = await globalSearch(query);
        setResults(searchResults as any);
      } else {
        setResults({ clients: [], prospects: [] });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const onSelect = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-500 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors"
      >
        <Search className="h-3 w-3" />
        <span>Search anything...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-zinc-500 opacity-100 italic">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Type a command or search..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[70vh]">
          <CommandEmpty>No results found.</CommandEmpty>
          
          {results.clients.length > 0 && (
            <CommandGroup heading="Clients">
              {results.clients.map((client) => (
                <CommandItem key={client.id} onSelect={() => onSelect(`/clients/${client.id}`)}>
                  <User className="mr-2 h-4 w-4" />
                  <span>{client.name}</span>
                  <span className="ml-2 text-[10px] text-zinc-500 italic">({client.type})</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}



          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => onSelect("/copilot")}>
              <MessageSquare className="mr-2 h-4 w-4 text-primary" />
              <span>Open Copilot</span>
              <CommandShortcut>⌘R</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => onSelect("/meetings")}>
              <Calendar className="mr-2 h-4 w-4 text-amber-400" />
              <span>Open Meeting Prep</span>
            </CommandItem>
            <CommandItem onSelect={() => onSelect("/vault")}>
              <FileText className="mr-2 h-4 w-4 text-blue-400" />
              <span>Open Vault</span>
            </CommandItem>
            <CommandItem onSelect={() => onSelect("/compliance")}>
              <Shield className="mr-2 h-4 w-4 text-emerald-400" />
              <span>Compliance Review</span>
            </CommandItem>
          </CommandGroup>
          
          <CommandSeparator />
          
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => onSelect("/meetings")}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Meetings</span>
            </CommandItem>
            <CommandItem onSelect={() => onSelect("/clients")}>
              <User className="mr-2 h-4 w-4" />
              <span>Clients</span>
            </CommandItem>
            <CommandItem onSelect={() => onSelect("/vault")}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Vault</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function Star({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
