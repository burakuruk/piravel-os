import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Geliştirme göstergesi (sol alt "N" rozeti) sidebar'ın kullanıcı bloğunu
  // örtüyordu ve ekran görüntülerine artefakt olarak giriyordu.
  devIndicators: false,
};

export default nextConfig;
