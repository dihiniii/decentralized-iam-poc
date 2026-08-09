// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAMRegistry
/// @notice A decentralized registry for identities (DIDs) and a tamper-evident,
///         hash-chained audit log shared across multiple cloud verifiers.
contract IAMRegistry {
    struct DIDRecord {
        bool exists;
        bool revoked;
        address controller;
    }

    // key = keccak256(DID string)
    mapping(bytes32 => DIDRecord) public dids;

    struct AuditEntry {
        uint256 id;
        bytes32 didHash;
        string cloud;
        string action;
        bool granted;
        uint256 timestamp;
        bytes32 prevHash;   // links to the previous entry (hash chain)
        bytes32 entryHash;  // hash of this entry
    }

    AuditEntry[] public audits;
    bytes32 public lastHash;

    event DIDRegistered(bytes32 indexed didHash, address controller);
    event DIDRevoked(bytes32 indexed didHash);
    event AuditLogged(
        uint256 indexed id,
        bytes32 indexed didHash,
        string cloud,
        string action,
        bool granted,
        bytes32 entryHash
    );

    /// @notice Register a new decentralized identifier.
    function registerDID(bytes32 didHash) external {
        require(!dids[didHash].exists, "DID already registered");
        dids[didHash] = DIDRecord(true, false, msg.sender);
        emit DIDRegistered(didHash, msg.sender);
    }

    /// @notice Revoke an existing DID (e.g. credential compromised).
    function revokeDID(bytes32 didHash) external {
        require(dids[didHash].exists, "DID not found");
        dids[didHash].revoked = true;
        emit DIDRevoked(didHash);
    }

    /// @notice True only if the DID exists and has not been revoked.
    function isValid(bytes32 didHash) external view returns (bool) {
        return dids[didHash].exists && !dids[didHash].revoked;
    }

    /// @notice Append a tamper-evident access-decision record to the shared log.
    function logAccess(
        bytes32 didHash,
        string calldata cloud,
        string calldata action,
        bool granted
    ) external returns (bytes32) {
        uint256 id = audits.length;
        bytes32 prev = lastHash;
        bytes32 entryHash = keccak256(
            abi.encodePacked(id, didHash, cloud, action, granted, block.timestamp, prev)
        );
        audits.push(
            AuditEntry(id, didHash, cloud, action, granted, block.timestamp, prev, entryHash)
        );
        lastHash = entryHash;
        emit AuditLogged(id, didHash, cloud, action, granted, entryHash);
        return entryHash;
    }

    function auditCount() external view returns (uint256) {
        return audits.length;
    }
}