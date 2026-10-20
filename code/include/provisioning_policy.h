#pragma once

#include <cstdint>

// The setup page must distinguish a live radio connection from credentials
// durably saved for the requested network.
class ProvisioningJoin
{
public:
    enum class Event { None, SaveCredentials, StopAttempt };

    explicit ProvisioningJoin(uint32_t timeoutMs) : timeoutMs_(timeoutMs) {}

    void begin(uint32_t now)
    {
        startedAt_ = now;
        state_ = State::Trying;
    }

    Event observe(uint32_t now, bool connectedToCandidate)
    {
        if (state_ != State::Trying) return Event::None;
        if (connectedToCandidate) return Event::SaveCredentials;
        if (now - startedAt_ < timeoutMs_) return Event::None;
        state_ = State::Failed;
        return Event::StopAttempt;
    }

    void markSaved()
    {
        if (state_ == State::Trying) state_ = State::Saved;
    }

    void markFailed() { state_ = State::Failed; }

    bool isTrying() const { return state_ == State::Trying; }
    bool dashboardReady(bool connectedToSavedNetwork) const
    {
        return state_ == State::Saved && connectedToSavedNetwork;
    }

private:
    enum class State { Idle, Trying, Failed, Saved };
    const uint32_t timeoutMs_;
    uint32_t startedAt_ = 0;
    State state_ = State::Idle;
};
