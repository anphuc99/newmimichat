export const OPENAI_VOICES = [
  { value: "alloy", label: "Alloy - Nu tre, tu nhien" },
  { value: "ballad", label: "Ballad - Nu diu dang, mem, tinh cam" },
  { value: "coral", label: "Coral - Nu tuoi sang, ro rang" },
  { value: "cedar", label: "Cedar - Nam truong thanh, tram am" },
  { value: "echo", label: "Echo - Trung tinh, nhe, co chieu sau" },
  { value: "fable", label: "Fable - Ke chuyen, truyen cam" },
  { value: "marin", label: "Marin - Nhe nhang, mang hoi tho bien" },
  { value: "nova", label: "Nova - Tre trung, nang luong" },
  { value: "onyx", label: "Onyx - Giong tram, huyen bi" }
] as const;

export type OpenAIVoiceValue = (typeof OPENAI_VOICES)[number]["value"];
