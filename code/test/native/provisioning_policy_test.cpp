#include <cassert>
#include <cstdint>

#include "provisioning_policy.h"

int main()
{
    // The observed join completed just after the old 25-second deadline.
    ProvisioningJoin lateJoin(60000);
    lateJoin.begin(1000);
    assert(lateJoin.observe(26000, false) == ProvisioningJoin::Event::None);
    assert(lateJoin.observe(28000, true) == ProvisioningJoin::Event::SaveCredentials);
    assert(!lateJoin.dashboardReady(true));
    lateJoin.markSaved();
    assert(lateJoin.dashboardReady(true));
    assert(!lateJoin.dashboardReady(false));

    // Once a real timeout occurs, a subsequent radio connection must not
    // masquerade as a saved setup or revive the old password candidate.
    ProvisioningJoin timedOut(60000);
    timedOut.begin(5000);
    assert(timedOut.observe(65000, false) == ProvisioningJoin::Event::StopAttempt);
    assert(timedOut.observe(67000, true) == ProvisioningJoin::Event::None);
    assert(!timedOut.dashboardReady(true));

    // A new submission is a new attempt, even after a prior failure.
    timedOut.begin(70000);
    assert(timedOut.observe(71000, true) == ProvisioningJoin::Event::SaveCredentials);
    timedOut.markSaved();
    assert(timedOut.dashboardReady(true));

    // A radio join is not enough when NVS refuses the write.
    ProvisioningJoin storageFailure(60000);
    storageFailure.begin(100);
    assert(storageFailure.observe(200, true) == ProvisioningJoin::Event::SaveCredentials);
    storageFailure.markFailed();
    assert(!storageFailure.dashboardReady(true));

    // millis() wraps roughly every 49 days; timeout arithmetic must survive it.
    ProvisioningJoin wrappedClock(60000);
    wrappedClock.begin(UINT32_MAX - 1000);
    assert(wrappedClock.observe(2000, false) == ProvisioningJoin::Event::None);
}
