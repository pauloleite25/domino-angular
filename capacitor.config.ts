import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "br.com.domino.mesa",
    appName: "Domino Mesa",
    webDir: "dist/domino-angular/browser",
    server: {
        androidScheme: "http",
        cleartext: true,
    },
};

export default config;
