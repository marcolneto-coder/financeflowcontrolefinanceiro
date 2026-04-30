import type { CardBrand } from "@/lib/finance-store";

const brandLogos: Record<CardBrand, { name: string; svg: React.ReactNode }> = {
  visa: {
    name: "Visa",
    svg: (
      <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
        <rect width="48" height="32" rx="4" fill="#1A1F71" />
        <path d="M19.5 21H17L18.8 11H21.3L19.5 21ZM15.3 11L12.9 17.8L12.6 16.3L12.6 16.3L11.7 12C11.7 12 11.6 11 10.3 11H6.1L6 11.2C6 11.2 7.5 11.5 9.2 12.5L11.4 21H14L18 11H15.3ZM35 21H37.5L35.3 11H33.3C32.2 11 31.9 11.8 31.9 11.8L28 21H30.6L31.1 19.5H34.3L35 21ZM31.9 17.5L33.3 13.8L34.1 17.5H31.9ZM28.5 13.5L28.9 11.3C28.9 11.3 27.6 10.8 26.2 10.8C24.7 10.8 21.2 11.5 21.2 14.5C21.2 17.3 25.2 17.3 25.2 18.8C25.2 20.3 21.6 20 20.4 19.1L19.9 21.4C19.9 21.4 21.3 22 23.2 22C25.1 22 28.5 20.9 28.5 18.2C28.5 15.4 24.5 15.1 24.5 13.9C24.5 12.7 27.3 12.9 28.5 13.5Z" fill="white" />
      </svg>
    ),
  },
  mastercard: {
    name: "Mastercard",
    svg: (
      <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
        <rect width="48" height="32" rx="4" fill="#252525" />
        <circle cx="19" cy="16" r="8" fill="#EB001B" />
        <circle cx="29" cy="16" r="8" fill="#F79E1B" />
        <path d="M24 10.3C25.9 11.7 27.1 13.7 27.1 16C27.1 18.3 25.9 20.3 24 21.7C22.1 20.3 20.9 18.3 20.9 16C20.9 13.7 22.1 11.7 24 10.3Z" fill="#FF5F00" />
      </svg>
    ),
  },
  elo: {
    name: "Elo",
    svg: (
      <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
        <rect width="48" height="32" rx="4" fill="#000" />
        <circle cx="16" cy="16" r="5" fill="#FFCB05" />
        <circle cx="24" cy="16" r="5" fill="#00A4E0" />
        <circle cx="32" cy="16" r="5" fill="#EF4123" />
        <text x="24" y="28" textAnchor="middle" fill="white" fontSize="5" fontWeight="bold">elo</text>
      </svg>
    ),
  },
  amex: {
    name: "Amex",
    svg: (
      <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
        <rect width="48" height="32" rx="4" fill="#006FCF" />
        <text x="24" y="19" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">AMEX</text>
      </svg>
    ),
  },
  hipercard: {
    name: "Hipercard",
    svg: (
      <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
        <rect width="48" height="32" rx="4" fill="#822124" />
        <text x="24" y="19" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" fontFamily="sans-serif">HIPER</text>
      </svg>
    ),
  },
  other: {
    name: "Outro",
    svg: (
      <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
        <rect width="48" height="32" rx="4" fill="#555" />
        <rect x="8" y="10" width="32" height="3" rx="1" fill="#888" />
        <rect x="8" y="17" width="20" height="2" rx="1" fill="#777" />
        <rect x="8" y="22" width="12" height="2" rx="1" fill="#777" />
      </svg>
    ),
  },
};

export function CardBrandIcon({ brand, className = "w-10 h-6" }: { brand: CardBrand; className?: string }) {
  const info = brandLogos[brand] || brandLogos.other;
  return <div className={className}>{info.svg}</div>;
}

export function CardBrandName({ brand }: { brand: CardBrand }) {
  return <span>{brandLogos[brand]?.name || "Outro"}</span>;
}

export const CARD_BRANDS: { value: CardBrand; label: string }[] = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "hipercard", label: "Hipercard" },
  { value: "other", label: "Outro" },
];
