// A simple Role-Based Access Control (RBAC) policy, enforced identically
// by every cloud from the shared decentralized control plane.
// Each cloud maps a role -> the set of actions that role may perform.

const POLICIES = {
  aws: {
    admin: ["read", "write", "delete"],
    user: ["read", "write"],
    guest: ["read"],
  },
  azure: {
    admin: ["read", "write", "delete"],
    user: ["read"],       // deliberately stricter than AWS, to show per-cloud policy
    guest: [],
  },
};

// Decide whether a role may perform an action on a given cloud.
function isAllowed(cloud, role, action) {
  const cloudPolicy = POLICIES[cloud];
  if (!cloudPolicy) return false;
  const allowed = cloudPolicy[role] || [];
  return allowed.includes(action);
}

module.exports = { isAllowed, POLICIES };