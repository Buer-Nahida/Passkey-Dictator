# Passkey Dictator

**网站没有权限决定我用什么存 Passkey**

**Passkey Dictator** 是一个 Firefox 扩展，专门处理那些对“你的 Passkey 必须存在哪里”管得过宽的网站

有些网站会把平台认证器（platform authenticator）当成使用 Passkey 的唯一正确方式。结果就是，明明 YubiKey 这类 roaming / cross-platform FIDO2 认证器支持可发现凭证（discoverable credential）和用户验证（user verification），网站却在浏览器真正尝试认证之前就把它排除掉

Passkey Dictator 会移除这类人为门槛，让 Firefox 有机会调用你真正想用的认证器

> [English README](README.md)

## 它会做什么

除明确排除的网站外，Passkey Dictator 会对 WebAuthn 做三项有针对性的修改

### 1. 删除 `authenticatorAttachment`

当网站创建 Passkey 时写了：

```js
authenticatorSelection: {
  authenticatorAttachment: "platform";
}
```

Passkey Dictator 会在请求到达 Firefox 前，只删除 `authenticatorAttachment` 这一项

其他 WebAuthn 要求完全保留

### 2. 覆盖平台认证器可用性检测

对于：

```js
PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
```

网站会收到：

```js
true;
```

对于：

```js
PublicKeyCredential.getClientCapabilities();
```

Passkey Dictator 会保留 Firefox 返回的其他所有真实能力，只把下面两个字段强制设为 `true`：

```js
{
  userVerifyingPlatformAuthenticator: true,
  passkeyPlatformAuthenticator: true
}
```

其他字段原样保留

这样可以阻止某些网站把“当前没有内建 platform authenticator”当成“这个浏览器完全不能使用 Passkey”

## 排除的网站

Passkey Dictator **不会运行**在：

- `google.com` 及其子域名
- `github.com` 及其子域名

这是故意的

Google 和 GitHub 的认证流程确实会有意识地区分 platform authenticator 与 cross-device / roaming security-key 流程或对此有特殊提示。在这两个网站上，这种区分属于产品设计的一部分

因此 Google 和 GitHub 被明确排除

为什么？因为 Passkey Dictator 的目标是修复网站的 BUG，不是把所有 WebAuthn 产品设计强行改成一种模式

## 点名批判

请各位开发者们不要向他们学习

### Telegram Web

Telegram Web 的 Passkey 创建写了：

```js
authenticatorSelection: {
  authenticatorAttachment: "platform"
}
```

这个硬编码的 `platform` 会让 Firefox 在创建阶段直接排除 YubiKey，Linux 上没有平台验证器，所以会直接爆炸

但是他们明明支持 Yubikey，甚至连图标都兼容好了

安装 Passkey Dictator 后，Yubikey 可正常使用

然后他们还设置了 `attestation: "none"`，导致在浏览器上创建的通行密钥名称为空，我们不修这个，能跑就行

### Pixiv

Pixiv 的前端使用平台认证器能力检测来控制整个 Passkey UI

在 Linux + YubiKey 环境中：

- [x] Firefox WebAuthn
- [x] YubiKey FIDO2
- [x] YubiKey discoverable passkey
- [x] YubiKey user verification
- [ ] UVPAA

于是 Pixiv 直接显示“该设备或浏览器无法使用通行密钥”，甚至不给 Firefox 尝试 YubiKey 的机会

安装 Passkey Dictator 后，Yubikey 可正常使用

## 为什么会有这个扩展

硬件安全密钥是合格的 FIDO2 / Passkey 认证器

但在 WebAuthn 分类中属于 **cross-platform authenticator**，而不是 **platform authenticator**

问题出现在一些网站把：

```js
authenticatorAttachment: "platform";
```

或：

```js
isUserVerifyingPlatformAuthenticatorAvailable();
```

直接理解成：Passkey 到底支不支持？

这两个问题本来就不是一回事

Passkey Dictator 的原则很简单：**具体用哪一个认证器应该由用户选择**

但是，如果确实有意识地提供不同的 platform 与 cross-device/security-key 流程，那就不强行抹平这种区分

## 控制台日志

Passkey Dictator 修改网站行为时，会在页面控制台留下日志

例如：

```text
[Passkey Dictator] Forced isUserVerifyingPlatformAuthenticatorAvailable(): false -> true. Stop gatekeeping WebAuthn.
```

```text
[Passkey Dictator] Patched client capabilities: ...
```

```text
[Passkey Dictator] Nuked authenticatorAttachment="platform" on example.com. My key, my rules.
```

在被排除的网站上，运行时保险逻辑可能输出：

```text
[Passkey Dictator] Disabled on github.com: intentional platform/cross-device authenticator semantics are preserved.
```

## 安装

附带的 XPI 没有 Mozilla 签名。标准 Firefox 正式版不能永久安装未签名扩展

测试方法：

1. 打开 `about:debugging#/runtime/this-firefox`；
2. 点击 Load Temporary Add-on / 临时载入附加组件；
3. 选择下载到的 xpi 文件

Firefox 重启后，临时安装会消失

如果要在 Firefox 或基于其内核的浏览器中永久使用，你可以进入 `about:config` 把 `xpinstall.signatures.required` 设置为 `false`，但是标准 Firefox 可能没有这个选项

Passkey Dictator 要求 **Firefox 128 或更高版本**，因为扩展需要把 content script 运行在页面的 `MAIN` JavaScript world 中，才能真正覆盖网页调用的 WebAuthn API

## 隐私

Passkey Dictator 不发送、不收集、不保存任何数据

它没有服务器、账号系统、统计分析或遥测

它只在本地页面里修改相关 WebAuthn JavaScript API

## 风险提示

这个扩展的目的就是主动覆盖认证器策略，并伪造两个与 platform Passkey 有关的能力信号

大多数时候，这正是你安装它的理由

但确实存在网站真正依赖特定认证器类型，或者在看到 platform capability 后切换到某条平台专用代码路径的情况。遇到这种网站，流程仍可能失败或产生奇怪行为

如果某个网站开着 Passkey Dictator 后突然开始表演抽象艺术，你可以[提出一个 Issue](https://github.com/Buer-Nahida/Passkey-Dictator)

## LICENSE

使用 MIT 许可证，具体请见 [LICENSE](LICENSE) 文件
