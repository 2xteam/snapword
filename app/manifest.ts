import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SnapWord",
    short_name: "SnapWord",
    description: "단어를 추출·정리하고 학습하는 SnapWord",
    start_url: "/home",
    display: "standalone",
    background_color: "#04161b",
    theme_color: "#5fb8c9",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  };
}
