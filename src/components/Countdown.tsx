export default function Countdown({ label }: { label: string }) {
  return (
    <div className="text-[18px] tracking-wide text-neutral-400 text-center select-none">
      Tempo restante: <span className="text-neutral-200 font-semibold">{label}</span>
    </div>
  );
}
