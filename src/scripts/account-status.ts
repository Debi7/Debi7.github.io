// The member's status as a section of Clerk's profile card, between "Профиль" and "Адреса
// электронной почты". Added 2026-10-02 at the owner's request ("I would like to see the status
// inside the account card, under the profile, above the email address"). Used by
// src/pages/auth/account.astro, which reads the status from the user's public metadata.
//
// Clerk lets a site add whole pages to the profile card (customPages, as account-devices.ts does)
// and reorder them, but not put anything inside one of its own pages (Clerk Core 3, "Add custom
// pages and links to the <UserProfile /> component"). So this module inserts the section into the
// card's markup itself:
// - It is built from Clerk's own email section: the outer box, the header with its title and the
//   first row are cloned without their content, so the new section carries the same generated
//   classes and looks like its neighbours in both themes; the title becomes "Статус" and the row's
//   text the status. Nothing of the email - no address, no menu - is copied.
// - Clerk renders the card with React and replaces a page when the visitor switches tabs, so a
//   MutationObserver puts the section back before the email section whenever it is missing or out
//   of place, and does nothing while it is in place (its own insertion therefore ends the loop).
// - It finds the email section by Clerk's documented class hooks (cl-profileSection__emailAddresses
//   and the cl-profileSection* parts, @clerk/ui 1.36.0, src/elements/Section.tsx and
//   UserProfile/EmailsSection.tsx). If a Clerk update renames them, nothing is inserted and the
//   caller's fallback shows the status above the card; recheck these names after a Clerk update,
//   as AUTH.md 12.6 asks for the sign-in form's.

const emailSelector = ".cl-profileSection__emailAddresses";
const marker = "data-kb-status";

/**
 * Keeps a "Статус" section with `label` before the email section of the profile card in `card`.
 * `onShown` runs every time the section is put in place, so the caller can hide its fallback.
 */
export function statusInProfile(
  card: HTMLElement,
  label: string,
  onShown: () => void,
): void {
  const place = () => {
    const email = card.querySelector<HTMLElement>(emailSelector);
    if (email === null) return;
    const own = card.querySelector(`[${marker}]`);
    if (own !== null && own.nextElementSibling === email) return;
    own?.remove();
    const section = build(email, label);
    if (section === undefined) return;
    email.before(section);
    onShown();
  };
  new MutationObserver(place).observe(card, { childList: true, subtree: true });
  place();
}

// The section, cloned from the email section's parts; undefined when one of them is not found.
function build(email: HTMLElement, label: string): HTMLElement | undefined {
  const content = email.querySelector(":scope > .cl-profileSectionContent");
  const header = email.querySelector(":scope > .cl-profileSectionHeader");
  const list = email.querySelector(".cl-profileSectionItemList");
  const item = email.querySelector(".cl-profileSectionItem");
  const row = item?.firstElementChild;
  const text = row?.querySelector("p");
  if (
    content === null ||
    header === null ||
    list === null ||
    item === null ||
    row === null ||
    row === undefined ||
    text === null ||
    text === undefined
  ) {
    return undefined;
  }
  const section = email.cloneNode(false);
  const ownHeader = header.cloneNode(true);
  if (!(section instanceof HTMLElement) || !(ownHeader instanceof Element)) {
    return undefined;
  }
  const title = ownHeader.querySelector(".cl-profileSectionTitleText");
  if (title === null) return undefined;
  title.textContent = "Статус";
  const value = text.cloneNode(false);
  value.textContent = label;
  const ownRow = row.cloneNode(false);
  ownRow.appendChild(value);
  const ownItem = item.cloneNode(false);
  ownItem.appendChild(ownRow);
  const ownList = list.cloneNode(false);
  ownList.appendChild(ownItem);
  const ownContent = content.cloneNode(false);
  ownContent.appendChild(ownList);
  // Content first, then the header: the order of Clerk's own sections (the box lays them out in
  // reverse).
  section.append(ownContent, ownHeader);
  // Clerk's per-section class hooks say "emailAddresses"; renamed so that no rule or script aimed
  // at the email section reaches this one.
  for (const element of [section, ...section.querySelectorAll("*")]) {
    for (const name of [...element.classList]) {
      if (name.endsWith("__emailAddresses")) {
        element.classList.replace(
          name,
          name.replace("__emailAddresses", "__kbStatus"),
        );
      }
    }
    element.removeAttribute("id");
  }
  section.setAttribute(marker, "");
  return section;
}
