#pragma once

// Copy to server_ca.h and insert the verified root CA certificate for the
// Render domain. Keep the matching certificate in this ignored local file.
// Do not paste a leaf certificate or disable verification.
constexpr char AVATAR_SERVER_CA_PEM[] = R"PEM(-----BEGIN CERTIFICATE-----
PASTE_VERIFIED_ROOT_CA_PEM_HERE
-----END CERTIFICATE-----
)PEM";
