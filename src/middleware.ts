// ключевой файл делает редирект с / на нужный язык до рендера страницы, читая cookie (и синхронизируем с localStorage на клиенте)

import { defineMiddleware } from "astro:middleware";

const LOCALES = ["en", "ru"] as const;
const DEFAULT_LOCALE = "en";
const LANG_COOKIE = "blog-lang";

export const onRequest = defineMiddleware((context, next) => {
  const { url, cookies, redirect } = context;
  const pathname = url.pathname;

  // Пропускаем всё, что не относится к страницам (ассеты, api и т.д.)
  if (
    pathname.startsWith("/_") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // файлы с расширением (favicon.ico, .png и т.п.)
  ) {
    return next();
  }

  // Проверяем, есть ли уже локаль в пути
  const hasLocale = LOCALES.some(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`),
  );

  if (hasLocale) {
    return next();
  }

  // Локаль не указана — определяем из cookie, потом из Accept-Language, потом дефолт
  const cookieLang = cookies.get(LANG_COOKIE)?.value;
  let lang: string = DEFAULT_LOCALE;

  if (cookieLang && (LOCALES as readonly string[]).includes(cookieLang)) {
    lang = cookieLang;
  } else {
    const accept = context.request.headers.get("accept-language") || "";
    if (accept.toLowerCase().includes("ru")) {
      lang = "ru";
    }
  }

  // Редирект на /<lang>/<path>
  const newPath = pathname === "/" ? `/${lang}/` : `/${lang}${pathname}`;
  return redirect(newPath, 302);
});
