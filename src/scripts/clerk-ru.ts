// Clerk's Russian localization with the gaps filled that can show on this site's three auth pages.
// Added 2026-09-26, when the styled sign-up form showed its password placeholder in English:
// ruRU in @clerk/localizations 4.20.0 translates 723 of the 1,629 strings enUS has, and a string it
// lacks falls back to English. Most of the missing ones belong to features this site does not
// use (organizations, billing, SSO, API keys, phone and Web3 sign-in); the ones below are those
// that the sign-in, sign-up and profile components can print with email and password sign-in,
// found by comparing the two locale objects key by key.
//
// When @clerk/localizations is upgraded, compare again: a key translated upstream can be removed
// here, and a new English string may have appeared. The strings are Russian because the site is
// (site.language in src/config.ts); the wording follows ruRU's own, which addresses the visitor
// formally ("Вы", "Ваш").
import { ruRU } from "@clerk/localizations";

// Added 2026-09-28 at the colleague's request after their first sign-in: ruRU puts the application
// name in straight double quotes ("Войти в "{{applicationName}}""), which reads as a quotation in
// the title and subtitle of every form. bare() keeps ruRU's own wording and drops only the quotes,
// so an upstream rewording still comes through. ruRU 4.20.0 quotes the name in the fifteen strings
// below (signIn and signUp); the four that leave it bare already (organizationList,
// reverification, signIn.emailLinkMfa) are not touched. Compare again when the package moves.
const bare = (text: string | undefined) =>
  text?.replace(`"{{applicationName}}"`, "{{applicationName}}");

export const localization = {
  ...ruRU,
  formFieldInputPlaceholder__signUpPassword: "Придумайте пароль",
  formFieldInput__emailAddress_format: "Пример формата: name@example.com",
  identityPreviewEditButton__emailAddress: "Изменить адрес почты",
  identityPreviewEditButton__identifier: "Изменить",
  signIn: {
    ...ruRU.signIn,
    // Added 2026-09-28: the application name without quotes (bare() above says why).
    start: {
      ...ruRU.signIn?.start,
      title: bare(ruRU.signIn?.start?.title),
      titleCombined: bare(ruRU.signIn?.start?.titleCombined),
      subtitle: bare(ruRU.signIn?.start?.subtitle),
    },
    password: {
      ...ruRU.signIn?.password,
      subtitle: bare(ruRU.signIn?.password?.subtitle),
    },
    emailCode: {
      ...ruRU.signIn?.emailCode,
      subtitle: bare(ruRU.signIn?.emailCode?.subtitle),
    },
    emailCodeMfa: {
      ...ruRU.signIn?.emailCodeMfa,
      subtitle: bare(ruRU.signIn?.emailCodeMfa?.subtitle),
    },
    phoneCode: {
      ...ruRU.signIn?.phoneCode,
      subtitle: bare(ruRU.signIn?.phoneCode?.subtitle),
    },
    backupCodeMfa: {
      ...ruRU.signIn?.backupCodeMfa,
      subtitle: bare(ruRU.signIn?.backupCodeMfa?.subtitle),
    },
    emailLink: {
      ...ruRU.signIn?.emailLink,
      // Added 2026-09-28: the application name without quotes (bare() above says why).
      subtitle: bare(ruRU.signIn?.emailLink?.subtitle),
      verifiedTransferable: {
        title: "Почта подтверждена",
        subtitle: "Вернитесь на исходную вкладку, чтобы продолжить",
      },
    },
    passwordCompromised: {
      ...ruRU.signIn?.passwordCompromised,
      title: "Пароль скомпрометирован",
    },
    passwordUntrusted: {
      ...ruRU.signIn?.passwordUntrusted,
      title: "Ненадёжный пароль",
    },
    protectCheck: {
      title: "Проверка запроса",
      subtitle: "Подождите, мы проверяем Ваш запрос.",
      loading: "Загрузка…",
      retryButton: "Повторить",
    },
  },
  signUp: {
    ...ruRU.signUp,
    // Added 2026-09-28: the application name without quotes (bare() above says why).
    start: {
      ...ruRU.signUp?.start,
      subtitle: bare(ruRU.signUp?.start?.subtitle),
      subtitleCombined: bare(ruRU.signUp?.start?.subtitleCombined),
    },
    continue: {
      ...ruRU.signUp?.continue,
      subtitle: bare(ruRU.signUp?.continue?.subtitle),
    },
    emailCode: {
      ...ruRU.signUp?.emailCode,
      subtitle: bare(ruRU.signUp?.emailCode?.subtitle),
    },
    emailLink: {
      ...ruRU.signUp?.emailLink,
      subtitle: bare(ruRU.signUp?.emailLink?.subtitle),
    },
    phoneCode: {
      ...ruRU.signUp?.phoneCode,
      subtitle: bare(ruRU.signUp?.phoneCode?.subtitle),
    },
    protectCheck: {
      title: "Проверка запроса",
      subtitle: "Подождите, мы проверяем Ваш запрос.",
      loading: "Загрузка…",
      retryButton: "Повторить",
    },
  },
  taskResetPassword: {
    ...ruRU.taskResetPassword,
    title: "Смените пароль",
    subtitle: "Чтобы продолжить, задайте новый пароль",
    formButtonPrimary: "Сменить пароль",
    signOut: {
      actionText: "Вы вошли как {{identifier}}",
      actionLink: "Выйти",
    },
  },
};
