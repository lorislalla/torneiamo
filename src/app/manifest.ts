import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Torneiamo — Gestione tornei",
    short_name: "Torneiamo",
    description: "Crea tornei, inserisci risultati e segui classifiche e tabelloni automatici.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#07110d",
    theme_color: "#07110d",
    lang: "it",
    categories: ["sports", "utilities", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/maskable-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

