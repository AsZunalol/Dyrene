import type { HubIconName } from "@/components/HubIcon";

type Rule = { title: string; text?: string; points?: string[]; ordered?: boolean };
export type RuleGroup = {
  id: string;
  title: string;
  description: string;
  icon: HubIconName;
  rules: Rule[];
};

// English translation of the rules in "the Strays.pdf". Repeated provisions
// from its two rulebooks are combined; distinct requirements are retained.
export const ruleGroups: RuleGroup[] = [
  {
    id: "ten-commandments",
    title: "The 10 Commandments",
    description: "The ten principles from the Strays' code of conduct, in their original order.",
    icon: "shield",
    rules: [
      { title: "I — Loyalty", text: "Loyalty is the foundation. Becoming a Stray means accepting that the group's interests come before personal conflicts." },
      { title: "II — Respect", text: "All members are treated with respect. Rank brings responsibility, not the right to treat others badly." },
      { title: "III — Confidentiality", text: "Internal matters stay internal. The group's plans, decisions, members, and internal affairs are not shared with outsiders without permission." },
      { title: "IV — Family first", text: "A Stray does not leave another Stray behind without a reason. If a member has a problem, help solve it instead of making it worse." },
      { title: "V — No ego", text: "Personal pride must never damage the group's public image. You do not have to win every conflict." },
      { title: "VI — Protect the business", text: "The business is the Strays' official public face. Treat it professionally and never put it at unnecessary risk." },
      { title: "VII — No false promises", text: "Nobody may make promises on the organisation's behalf without a mandate. If you have not been authorised to speak for the Strays, you speak only for yourself." },
      { title: "VIII — OOC stays OOC", text: "Never use out-of-character information for an in-game advantage. No metagaming, powergaming, or other violations of the server's rules." },
      { title: "IX — Respect the hierarchy", text: "Leadership makes the final decisions. You may disagree, but disagreements are handled internally." },
      { title: "X — If you know, you know", text: "Not everyone needs to know the whole story." },
    ],
  },
  {
    id: "values",
    title: "Loyalty & respect",
    description: "The principles behind the name.",
    icon: "gangs",
    rules: [
      { title: "The Strays come first", text: "The Strays are an organisation, a family, and a business. Put the group's interests ahead of personal interests, pride, and conflicts. The name comes before the ego." },
      { title: "Respect goes both ways", text: "Treat every member with respect, regardless of rank. Rank brings responsibility, never the right to mistreat others. Treat other players with courtesy and maturity." },
      { title: "Look after the family", text: "Do not leave another Stray behind without a reason. When a member is in trouble, help solve the problem instead of making it worse." },
      { title: "Keep a cool head", text: "Do not act impulsively when it could harm the group or the business. Avoid unnecessary drama. You do not need to win every argument or let personal pride damage the group's reputation." },
      { title: "Earn trust and loyalty", text: "Trust and loyalty must be earned. Accepting the Strays name means accepting the responsibility that comes with it, even when you do not like or agree with everyone." },
    ],
  },
  {
    id: "roleplay",
    title: "Roleplay & player etiquette",
    description: "Good roleplay comes before winning.",
    icon: "shield",
    rules: [
      { title: "Follow the server rules", text: "The Strays always follow the server's official rules. Breaking a rule to win is never acceptable. Internal decisions and consequences must also respect the server's roleplay rules." },
      { title: "Keep IC and OOC separate", text: "IC means in character; OOC means out of character. Never use OOC information for an in-game advantage or bring OOC drama into the game." },
      { title: "Unacceptable play", points: ["Metagaming or powergaming.", "RDM (random deathmatch) or VDM (vehicle deathmatch).", "FailRP or other violations of the server's roleplay rules.", "Using OOC information or conflicts to influence in-game events."] },
      { title: "Be someone others can play with", text: "Cooperate, respect other players, accept criticism and opportunities to improve, and contribute to good roleplay. Think before acting: one poor decision can affect the entire group's RP." },
    ],
  },
  {
    id: "confidentiality",
    title: "Confidentiality & representation",
    description: "Keep internal matters internal. Speak only with authority.",
    icon: "lock",
    rules: [
      { title: "Protect internal information", text: "Do not discuss internal matters with outsiders. Members, roles, plans, decisions, and internal agreements must not be disclosed without permission. Not everyone needs to know the whole story: if you know, you know." },
      { title: "Take responsibility for your own actions", text: "If police or other authorities ask about the group in roleplay, take responsibility for your own part without speaking about the organisation. Disclosing internal matters can carry internal consequences under the server's RP rules." },
      { title: "Do not speak without a mandate", text: "Do not make promises or claim to speak for leadership without permission. Without a mandate, you speak only for yourself. If you say the Strays are backing you, that must actually be true." },
      { title: "Do not misuse the name", text: "Never use the Strays name for personal revenge, private disputes, unjustified threats, or actions that create problems for the business. Everyone using the name represents the entire organisation." },
    ],
  },
  {
    id: "membership",
    title: "Ranks & membership",
    description: "Responsibility is earned, and leadership has the final say.",
    icon: "user",
    rules: [
      { title: "Bosses", text: "The organisation's senior leaders have the final say. They are responsible for overall strategy, the business, alliances, internal disputes, and admitting or removing members." },
      { title: "Underboss", text: "The bosses' right hand keeps the organisation together: daily management, coordination, oversight of members, handling problems when the bosses are absent, and carrying out their decisions." },
      { title: "Officer", text: "A trusted leader responsible for a smaller group and day-to-day coordination. Officers oversee members, train trial members, report to leadership, and handle minor disputes." },
      { title: "Member", text: "A full member has the group's trust, access to internal areas, and the right to participate in internal decisions. Members are responsible for protecting the organisation's interests." },
      { title: "Associate / Pup", text: "A potential member who has not yet earned full trust. Associates are assessed on loyalty, mature OOC conduct, cooperation, roleplay quality, and their ability to keep internal matters confidential." },
      { title: "Trial member", text: "A newcomer who has not yet proven their loyalty. Trial members are trained by officers and must demonstrate that they belong in the group." },
      { title: "Friend of the Strays", text: "An outsider who works with the organisation, often simply called a ‘Friend’. Friends are not members and receive only the information they need." },
      { title: "Joining and progressing", text: "Nobody becomes a full member on day one or simply by asking. Leadership observes new people over a trial period and decides when an associate is ready to advance.", points: ["Show loyalty, discretion, and the ability to work with others.", "Respect the hierarchy and other players.", "Understand the difference between IC and OOC, and between the group's public image and internal affairs.", "Accept feedback, create good RP, and avoid unnecessary trouble or drama."] },
      { title: "Respect the chain of command", text: "You may disagree with leadership, but disagreements are handled internally. The bosses' decision is the final authority." },
    ],
  },
  {
    id: "business",
    title: "Business & shared funds",
    description: "Protect the public face of the group and its shared resources.",
    icon: "shop",
    rules: [
      { title: "Keep the business professional", text: "The business is the Strays' official public face and legitimate front in roleplay. Treat customers and employees properly, care for its assets, follow management's instructions, and avoid unnecessary attention or risk." },
      { title: "Separate business and group affairs", text: "Keep disputes, trouble, and illegal in-character activities separate from official business operations. The business is not automatically involved in everything the organisation does. Employees outside the group do not need to know all its internal affairs." },
      { title: "Shared money belongs to the group", text: "Do not take from shared funds without permission or conceal earnings from the group. Keep personal finances separate from the organisation's finances. Nobody gets rich alone using the Strays name." },
      { title: "Get approval for assets and spending", text: "Do not use business money or shared assets privately without an agreement, or sell the organisation's property without permission. Leadership must approve major purchases and financial decisions made on the group's behalf." },
    ],
  },
  {
    id: "communication",
    title: "Communication & meetings",
    description: "Clear messages, factual discussions, and room for everyone to speak.",
    icon: "terminal",
    rules: [
      { title: "Keep messages clear", text: "Internal messages should be short and clear. Use the relevant internal channels for important decisions so leadership can keep track of the information." },
      { title: "Meeting etiquette", text: "Leadership may call a meeting at any time.", points: ["Do not interrupt.", "Give everyone an opportunity to speak.", "Present problems with facts.", "Do not make personal attacks.", "Leadership makes the final decision. Once the meeting ends, that decision takes effect and is final."], ordered: true },
    ],
  },
  {
    id: "accountability",
    title: "Conflicts & consequences",
    description: "Resolve disagreements internally and take responsibility.",
    icon: "shield",
    rules: [
      { title: "Resolve problems in order", text: "Do not turn an internal disagreement into a public conflict or an internal war over something trivial.", points: ["Talk to each other first.", "If the issue remains, involve an Officer.", "Escalate unresolved issues to the Underboss.", "Leadership makes the final ruling."], ordered: true },
      { title: "Betrayal is a serious violation", text: "Deliberately harming the organisation, leaking internal information, abusing rank, stealing from the group, or actively working against its interests are serious breaches. Leadership assesses each case in its specific RP context and under the server's rules." },
      { title: "Internal consequences", text: "Leadership determines the appropriate consequence for the situation, within the server's roleplay rules. Possible consequences are:", points: ["Warning — for a minor violation.", "Probation — temporarily restricted trust, responsibilities, or privileges.", "Demotion — loss of rank or responsibility.", "Suspension — temporarily excluded from the organisation's activities.", "Exile — permanent removal from the Strays."], ordered: true },
    ],
  },
  {
    id: "language",
    title: "Internal language",
    description: "The expressions used within the family.",
    icon: "gangs",
    rules: [
      { title: "Family", text: "A full member." },
      { title: "Stray", text: "A member of the organisation." },
      { title: "Pup", text: "An associate." },
      { title: "Outside", text: "Someone outside the organisation." },
      { title: "The Family is watching.", text: "Leadership is aware of the situation." },
      { title: "Keep it quiet.", text: "Do not discuss the subject any further." },
      { title: "If you know, you know.", text: "The information is only for those who already know it." },
    ],
  },
];
