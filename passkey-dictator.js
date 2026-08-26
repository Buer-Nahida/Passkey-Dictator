(() => {
  'use strict';

  const TAG = '[Passkey Dictator]';
  const PATCH_MARK = '__passkeyDictator';

  // Defense in depth: manifest.json already excludes these sites, but keep a
  // runtime guard as well so inherited/about:blank contexts cannot accidentally
  // flatten authenticator distinctions on known intentional implementations.
  const EXCLUDED_HOSTS = new Set(['google.com', 'github.com']);
  const hostname = globalThis.location?.hostname?.toLowerCase() || '';
  const isExcludedHost = [...EXCLUDED_HOSTS].some(
    root => hostname === root || hostname.endsWith(`.${root}`)
  );

  if (isExcludedHost) {
    console.info(`${TAG} Disabled on ${hostname}: intentional platform/cross-device authenticator semantics are preserved.`);
    return;
  }

  // ---------------------------------------------------------------------------
  // 1. Capability gate bypass
  // ---------------------------------------------------------------------------
  // Some relying parties incorrectly treat a user-verifying *platform*
  // authenticator as a prerequisite for Passkeys in general. A roaming FIDO2
  // authenticator can still be perfectly capable of discoverable credentials
  // and user verification, so we refuse that gate.
  const PKC = globalThis.PublicKeyCredential;

  if (PKC) {
    const originalUVPAA = PKC.isUserVerifyingPlatformAuthenticatorAvailable;

    if (
      typeof originalUVPAA === 'function' &&
      !originalUVPAA[PATCH_MARK]
    ) {
      const patchedUVPAA = async function (...args) {
        let nativeResult;

        try {
          nativeResult = await Reflect.apply(originalUVPAA, PKC, args);
        } catch (error) {
          console.warn(
            `${TAG} Native isUserVerifyingPlatformAuthenticatorAvailable() threw; overriding with true.`,
            error
          );
        }

        if (nativeResult !== true) {
          console.warn(
            `${TAG} Forced isUserVerifyingPlatformAuthenticatorAvailable(): ${String(nativeResult)} -> true. Stop gatekeeping WebAuthn.`
          );
        }

        return true;
      };

      Object.defineProperty(patchedUVPAA, PATCH_MARK, {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });

      try {
        Object.defineProperty(
          PKC,
          'isUserVerifyingPlatformAuthenticatorAvailable',
          {
            configurable: true,
            writable: true,
            value: patchedUVPAA
          }
        );
      } catch (error) {
        console.error(
          `${TAG} Failed to patch isUserVerifyingPlatformAuthenticatorAvailable().`,
          error
        );
      }
    }

    // Keep the newer capability API consistent with the UVPAA override, while
    // preserving every unrelated capability exactly as Firefox reported it.
    const originalGetClientCapabilities = PKC.getClientCapabilities;

    if (
      typeof originalGetClientCapabilities === 'function' &&
      !originalGetClientCapabilities[PATCH_MARK]
    ) {
      const patchedGetClientCapabilities = async function (...args) {
        const capabilities = await Reflect.apply(
          originalGetClientCapabilities,
          PKC,
          args
        );

        const nativeCapabilities = capabilities || {};
        const patchedCapabilities = {
          ...nativeCapabilities,
          userVerifyingPlatformAuthenticator: true,
          passkeyPlatformAuthenticator: true
        };

        if (
          nativeCapabilities.userVerifyingPlatformAuthenticator !== true ||
          nativeCapabilities.passkeyPlatformAuthenticator !== true
        ) {
          console.warn(`${TAG} Patched client capabilities:`, {
            userVerifyingPlatformAuthenticator: [
              nativeCapabilities.userVerifyingPlatformAuthenticator,
              true
            ],
            passkeyPlatformAuthenticator: [
              nativeCapabilities.passkeyPlatformAuthenticator,
              true
            ]
          });
        }

        return patchedCapabilities;
      };

      Object.defineProperty(patchedGetClientCapabilities, PATCH_MARK, {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });

      try {
        Object.defineProperty(PKC, 'getClientCapabilities', {
          configurable: true,
          writable: true,
          value: patchedGetClientCapabilities
        });
      } catch (error) {
        console.error(
          `${TAG} Failed to patch getClientCapabilities().`,
          error
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. authenticatorAttachment policy nuke
  // ---------------------------------------------------------------------------
  // The RP can choose cryptographic/security requirements. The user chooses
  // which compatible authenticator satisfies them.
  const proto = globalThis.CredentialsContainer?.prototype;

  if (proto && typeof proto.create === 'function') {
    const originalDescriptor = Object.getOwnPropertyDescriptor(proto, 'create');
    const originalCreate = proto.create;

    if (!originalCreate[PATCH_MARK]) {
      function create(options) {
        const selection = options?.publicKey?.authenticatorSelection;

        if (
          selection &&
          Object.prototype.hasOwnProperty.call(
            selection,
            'authenticatorAttachment'
          )
        ) {
          // Clone only the layers we modify. BufferSource values such as
          // challenge and user.id remain untouched.
          const patchedSelection = {...selection};
          const nukedValue = patchedSelection.authenticatorAttachment;
          delete patchedSelection.authenticatorAttachment;

          const patchedOptions = {
            ...options,
            publicKey: {
              ...options.publicKey,
              authenticatorSelection: patchedSelection
            }
          };

          console.warn(
            `${TAG} Nuked authenticatorAttachment=${JSON.stringify(nukedValue)} on ${location.hostname || location.href}. My key, my rules.`
          );

          return Reflect.apply(originalCreate, this, [patchedOptions]);
        }

        return Reflect.apply(originalCreate, this, [options]);
      }

      Object.defineProperty(create, PATCH_MARK, {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });

      try {
        Object.defineProperty(proto, 'create', {
          ...(originalDescriptor || {}),
          value: create
        });
      } catch (error) {
        console.error(
          `${TAG} Failed to patch navigator.credentials.create().`,
          error
        );
      }
    }
  }
})();
