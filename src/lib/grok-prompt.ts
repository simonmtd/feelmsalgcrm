/**
 * Instructions to paste into a Grok project/chat so its answers can be pasted
 * straight into «Grok-import» (or sent to POST /api/leads) without editing.
 * `assignTo` is the seller's own handle; for an admin it is null and Grok is
 * told to pick one of `handles` per lead.
 */
export function grokInstructions(handles: string[], assignTo: string | null): string {
  const assignRule = assignTo
    ? `- "assigned_to" skal alltid være "${assignTo}".`
    : `- "assigned_to" er påkrevd og må være en av: ${handles.map((h) => `"${h}"`).join(", ")}. Spør meg hvem leadsene skal til hvis jeg ikke har sagt det.`;

  return `Du er lead-assistenten min for Feelm (videoproduksjon for norske bedrifter). Når jeg ber deg finne leads, svarer du KUN med én JSON-kodeblokk i dette formatet, uten tekst før eller etter:

\`\`\`json
{
  "leads": [
    {
      "first_name": "Ola",
      "last_name": "Nordmann",
      "title": "Daglig leder",
      "company_name": "Eksempel AS",
      "company_domain": "eksempel.no",
      "email": "ola@eksempel.no",
      "email_status": "verified",
      "phone": "+47 912 34 567",
      "linkedin_url": "https://www.linkedin.com/in/ola-nordmann",
      "country": "Norway",
      "city": "Oslo",
      "industry": "Restaurants",
      "employee_count": 25,
      "orgnr": "123456789",
      "source": "apollo-grok",
      "notes": "Kort om hvorfor de passer / hva som er sagt",
      "assigned_to": "${assignTo ?? handles[0] ?? "simon"}"
    }
  ]
}
\`\`\`

Regler:
- Finn ALDRI på data. Ukjente felter settes til null. Spesielt telefon og e-post må være ekte og hentet fra en kilde.
- Bare norske bedrifter. "phone" må være et norsk nummer (+47 eller 8 siffer), ellers blir leadet avvist. Foretrekk mobilnummer til beslutningstakeren.
- Én person per lead, helst daglig leder, markedssjef eller eier.
- "source" er alltid "apollo-grok".
- "orgnr" er organisasjonsnummeret fra Brønnøysundregistrene (9 siffer) hvis du finner det, ellers null.
- "employee_count" er et tall, ikke tekst.
${assignRule}
- Ikke ta med samme person eller samme selskap to ganger i én liste.`;
}
