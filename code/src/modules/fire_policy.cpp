#include "fire_policy.h"

FirePolicy::FirePolicy(uint32_t confirmationMs, uint32_t maxResponseMs,
                       uint32_t clearHoldMs)
    : confirmationMs_(confirmationMs), maxResponseMs_(maxResponseMs),
      clearHoldMs_(clearHoldMs)
{
}

FireDecision FirePolicy::update(bool detected, bool sensorValid, uint32_t now,
                                bool resetRequested, bool actuatorReady)
{
    FireDecision result;

    if (!sensorValid)
    {
        result.stopResponse = responseActive_;
        responseActive_ = false;
        lockout_ = true;
        detectionPending_ = false;
        clearPending_ = false;
    }
    else if (responseActive_ && !actuatorReady)
    {
        responseActive_ = false;
        lockout_ = true;
        result.stopResponse = true;
        result.actionUnavailable = true;
    }
    else if (responseActive_)
    {
        // Unsigned subtraction remains correct across millis() rollover.
        if (now - responseStartedAt_ >= maxResponseMs_)
        {
            responseActive_ = false;
            lockout_ = true;
            result.stopResponse = true;
            clearPending_ = false;
        }
        else if (detected)
        {
            clearPending_ = false;
        }
        else if (!clearPending_)
        {
            clearPending_ = true;
            clearSince_ = now;
        }
        else if (now - clearSince_ >= clearHoldMs_)
        {
            responseActive_ = false;
            result.stopResponse = true;
            clearPending_ = false;
        }
    }
    else
    {
        if (resetRequested && !detected)
            lockout_ = false;

        if (detected && !lockout_)
        {
            if (!detectionPending_)
            {
                detectionPending_ = true;
                detectedSince_ = now;
            }
            else if (now - detectedSince_ >= confirmationMs_)
            {
                detectionPending_ = false;
                if (actuatorReady)
                {
                    responseActive_ = true;
                    responseStartedAt_ = now;
                    result.startResponse = true;
                }
                else
                {
                    lockout_ = true;
                    result.actionUnavailable = true;
                }
            }
        }
        else
        {
            detectionPending_ = false;
        }
    }

    result.responseActive = responseActive_;
    result.lockout = lockout_;
    return result;
}

FireDecision FirePolicy::emergencyStop()
{
    FireDecision result;
    result.stopResponse = responseActive_;
    responseActive_ = false;
    lockout_ = true;
    detectionPending_ = false;
    clearPending_ = false;
    result.lockout = true;
    return result;
}
