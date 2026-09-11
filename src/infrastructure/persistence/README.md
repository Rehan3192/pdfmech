# Local Persistence Boundary

This folder is reserved for the IndexedDB recovery implementation.

The editor depends on the `RecoveryStore` port. Production persistence must keep
source blobs, asset blobs, and recovery manifests local, expiring, and
user-deletable.
