/**
 * Node-RED settings for the Smart Bikestation dashboard.
 */
module.exports = {
    uiPort: 1880,

    // Editor API bound to the LAN so the laptop can reach it.
    // Bind to the board's own address only, not 0.0.0.0.
    httpAdminRoot: "/red",

    // No auth by default (isolated school LAN demo).
    // To require a login:
    //   adminAuth: { users: [ { username: "admin",
    //                           password: "<bcrypt-hash>",
    //                           permissions: "*" } ] }
    //   and set `flowFileCredentials` below to a real secret.
    // Generate the hash with:  node -e "console.log(require('bcryptjs').hashSync('pw',8))"

    credentialSecret: "bikestation-demo-only-please-rotate",

    flowFile: "flows.json",
    flowFileCredentials: "flows_cred.json",

    // Keep the editor usable without the "safe mode" dialog on first boot.
    editorTheme: {
        projects: {
            enabled: false
        }
    },

    logging: {
        console: {
            level: "info",
            metrics: false,
            audit: false
        }
    }
};
