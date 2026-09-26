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

export const localization = {
  ...ruRU,
  formFieldInputPlaceholder__signUpPassword: "Придумайте пароль",
  formFieldInput__emailAddress_format: "Пример формата: name@example.com",
  identityPreviewEditButton__emailAddress: "Изменить адрес почты",
  identityPreviewEditButton__identifier: "Изменить",
  signIn: {
    ...ruRU.signIn,
    emailLink: {
      ...ruRU.signIn?.emailLink,
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
