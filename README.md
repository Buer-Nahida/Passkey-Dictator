# Passkey Dictator

**Websites don't get to decide where I keep my Passkeys.**

**Passkey Dictator** is a Firefox extension for dealing with websites that overreach when deciding where your Passkeys are allowed to live.

Some websites treat a platform authenticator as the one and only correct way to use Passkeys. As a result, roaming / cross-platform FIDO2 authenticators such as YubiKeys may fully support discoverable credentials and user verification, yet the website excludes them before the browser even gets a chance to try.

Passkey Dictator removes these artificial roadblocks so Firefox can invoke the authenticator you actually want to use.

> [中文 README](README.zh-CN.md)

## What it does

Except on explicitly excluded websites, Passkey Dictator makes two targeted modifications to WebAuthn behavior.

### 1. Deletes `authenticatorAttachment`

When a website creates a Passkey with:

```js
authenticatorSelection: {
  authenticatorAttachment: "platform";
}
```

Passkey Dictator removes only the `authenticatorAttachment` property before the request reaches Firefox.

All other WebAuthn requirements are preserved.

### 2. Overrides platform-authenticator availability checks

For:

```js
PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
```

the website receives:

```js
true;
```

For:

```js
PublicKeyCredential.getClientCapabilities();
```

Passkey Dictator preserves every other real capability reported by Firefox and forces only these two fields to `true`:

```js
{
  userVerifyingPlatformAuthenticator: true,
  passkeyPlatformAuthenticator: true
}
```

All other fields are left untouched.

This prevents some websites from treating “there is no built-in platform authenticator right now” as “this browser cannot use Passkeys at all.”

## Excluded websites

Passkey Dictator **does not run** on:

- `google.com` and its subdomains
- `github.com` and its subdomains

This is intentional.

Google and GitHub deliberately distinguish platform authenticators from cross-device / roaming security-key flows, or provide special messaging and handling around that distinction. On these two websites, the distinction is part of the product design.

Google and GitHub are therefore explicitly excluded.

Why? Because Passkey Dictator exists to fix website BUGS, not to forcibly flatten every WebAuthn product design into one model.

## Hall of shame

Developers, please do not learn from these examples.

### Telegram Web

Telegram Web creates Passkeys with:

```js
authenticatorSelection: {
  authenticatorAttachment: "platform";
}
```

That hard-coded `platform` makes Firefox exclude YubiKeys at creation time. On Linux, where there may be no platform authenticator, the flow simply blows up.

And yet Telegram clearly supports YubiKeys. It even already has the icon support in place.

With Passkey Dictator installed, YubiKeys work normally.

Telegram also sets `attestation: "none"`, which causes Passkeys created in the browser to end up with an empty name. We do not fix that. If it works, it works.

### Pixiv

Pixiv's frontend uses platform-authenticator capability checks to gate the entire Passkey UI.

On Linux + YubiKey:

- [x] Firefox WebAuthn
- [x] YubiKey FIDO2
- [x] YubiKey discoverable passkey
- [x] YubiKey user verification
- [ ] UVPAA

Pixiv therefore displays “Passkeys cannot be used on this device or browser” without even giving Firefox a chance to try the YubiKey.

With Passkey Dictator installed, YubiKeys work normally.

## Why this extension exists

Hardware security keys are valid FIDO2 / Passkey authenticators.

In WebAuthn terminology, however, they are **cross-platform authenticators**, not **platform authenticators**.

The problem starts when some websites treat:

```js
authenticatorAttachment: "platform";
```

or:

```js
isUserVerifyingPlatformAuthenticatorAvailable();
```

as the answer to a completely different question: are Passkeys supported at all?

Those are not the same question.

Passkey Dictator follows one simple principle: **the user should choose which authenticator to use.**

However, if a website deliberately provides different platform and cross-device/security-key flows, Passkey Dictator does not forcibly erase that distinction.

## Console logs

When Passkey Dictator modifies website behavior, it leaves a message in the page console.

For example:

```text
[Passkey Dictator] Forced isUserVerifyingPlatformAuthenticatorAvailable(): false -> true. Stop gatekeeping WebAuthn.
```

```text
[Passkey Dictator] Patched client capabilities: ...
```

```text
[Passkey Dictator] Nuked authenticatorAttachment="platform" on example.com. My key, my rules.
```

On excluded websites, the runtime safety guard may print:

```text
[Passkey Dictator] Disabled on github.com: intentional platform/cross-device authenticator semantics are preserved.
```

## Installation

For firefox users: https://addons.mozilla.org/firefox/addon/passkey-dictator

The bundled XPI is not signed by Mozilla. Standard release builds of Firefox cannot permanently install unsigned extensions.

For testing:

1. Open `about:debugging#/runtime/this-firefox`;
2. Click **Load Temporary Add-on**;
3. Select the downloaded XPI file.

The temporary installation disappears after Firefox restarts.

For permanent use in Firefox or browsers based on its engine, you may be able to open `about:config` and set `xpinstall.signatures.required` to `false`, although standard Firefox builds may not expose this option.

Passkey Dictator requires **Firefox 128 or later** because the extension needs to run its content script in the page's `MAIN` JavaScript world in order to actually override the WebAuthn APIs called by websites.

## Privacy

Passkey Dictator does not send, collect, or store any data.

It has no server, account system, analytics, or telemetry.

It only modifies the relevant WebAuthn JavaScript APIs locally inside the page.

## Risks

This extension intentionally overrides authenticator-selection policy and falsifies two capability signals related to platform Passkeys.

Most of the time, that is exactly why you installed it.

However, some websites genuinely depend on a specific authenticator type, or may switch to a platform-specific code path after seeing platform capability. On those websites, the flow may still fail or behave strangely.

If a website suddenly starts performing abstract art with Passkey Dictator enabled, you can [open an Issue](https://github.com/Buer-Nahida/Passkey-Dictator/issues/new).

## LICENSE

Licensed under the MIT License. See [LICENSE](LICENSE) for details.
