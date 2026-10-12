// Pale ruled lines in the shape of a list, while a page loads.
export default function Loading() {
    return (
        <div className="folio py-8" role="status" aria-label="Loading">
            <div className="h-10 w-2/5 border-b border-rule mb-2" />
            {[72, 58, 84].map(w => (
                <div key={w} className="grid grid-cols-[3.4rem_minmax(0,1fr)] gap-3.5 py-5 border-b border-rule" aria-hidden="true">
                    <i className="block h-7 border border-rule" />
                    <span className="grid gap-4 pt-2">
                        <i className="block h-px bg-rule" style={{ width: `${w}%` }} />
                        <i className="block h-px bg-rule w-[94%]" />
                    </span>
                </div>
            ))}
            <span className="sr-only">Loading…</span>
        </div>
    )
}
