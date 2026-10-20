#pragma once

#include <stdint.h>

struct FireDecision
{
    bool responseActive = false;
    bool lockout = false;
    bool startResponse = false;
    bool stopResponse = false;
    bool actionUnavailable = false;
};

// Pure local control policy. Hardware reads and writes stay outside this class.
class FirePolicy
{
public:
    FirePolicy(uint32_t confirmationMs, uint32_t maxResponseMs, uint32_t clearHoldMs);
    FireDecision update(bool detected, bool sensorValid, uint32_t now,
                        bool resetRequested = false, bool actuatorReady = true);
    FireDecision emergencyStop();

private:
    uint32_t confirmationMs_;
    uint32_t maxResponseMs_;
    uint32_t clearHoldMs_;
    uint32_t detectedSince_ = 0;
    uint32_t responseStartedAt_ = 0;
    uint32_t clearSince_ = 0;
    bool detectionPending_ = false;
    bool clearPending_ = false;
    bool responseActive_ = false;
    bool lockout_ = false;
};
