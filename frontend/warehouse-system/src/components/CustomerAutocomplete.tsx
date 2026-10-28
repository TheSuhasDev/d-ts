import React from "react";

interface CustomerAutocompleteProps {
  client: { name: string; phone: string; address: string; gstin: string };
  onChange: (client: { name: string; phone: string; address: string; gstin: string }) => void;
  onOpenLedger?: (customerId: string) => void;
}

export function CustomerAutocomplete({
  client,
  onChange,
}: CustomerAutocompleteProps) {
  return (
    <div className="space-y-3">
      {/* Client Input Fields */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <input
          placeholder="Client / Company Name *"
          value={client.name}
          onChange={(e) => onChange({ ...client, name: e.target.value })}
          className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <input
          placeholder="Contact Phone *"
          value={client.phone}
          onChange={(e) => onChange({ ...client, phone: e.target.value })}
          className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <textarea
        placeholder="Delivery Destination Address *"
        value={client.address}
        onChange={(e) => onChange({ ...client, address: e.target.value })}
        rows={2}
        className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
      />
      <input
        placeholder="GSTIN (Optional, e.g. 29ABCDE1234F1Z5)"
        value={client.gstin}
        onChange={(e) => onChange({ ...client, gstin: e.target.value })}
        className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
      />
    </div>
  );
}
