# CPM Energie Tarifdaten-Spezifikation v2

## Zweck
Diese Spezifikation definiert die fachlichen und rechtlichen Mindestanforderungen für Tarife, die die CPM Vergleichsengine verarbeitet.

## Vertrags- und Kündigungsdaten

- `kuendigungsfrist_tage`: Kündigungsfrist in Tagen. Bei Sonderverträgen mit Verbrauchern darf der AGB-seitig vereinbarte Zeitraum vor Ablauf der zunächst vorgesehenen Vertragsdauer nicht länger als einen Monat sein. Werte über 30 werden durch die Engine abgelehnt.
- `verlaengerung_monate`: Legacy-/Darstellungsfeld für vorhandene Daten. Eine feste Verlängerung darf nicht als automatische erneute Bindung veröffentlicht werden.
- `verlaengerung_kuendbar_jederzeit`: Boolean. Wenn `verlaengerung_monate > 0`, muss dieses Feld `true` sein; andernfalls wird der Datensatz für die Veröffentlichung gesperrt.
- `verlaengerung_kuendigungsfrist_tage`: Kündigungsfrist während der Verlängerung. Maximal 30 Tage.
- `grundversorgung`: Boolean zur Kennzeichnung der Grundversorgung.
- `kuendigung_textform`: Für Grundversorgung `true`. Kundendarstellung: Kündigung in Textform, z. B. E-Mail, Brief oder Fax, mit zwei Wochen Frist und jederzeitiger Kündigungsmöglichkeit.

## Preisgarantie

`preisgarantie_ausnahmen` darf ausschließlich aus der konkreten Preisgarantie- bzw. Vertragsklausel des Anbieters übernommen werden. Die Ausnahmen dürfen nicht pauschal mit § 41 Abs. 6 EnWG begründet werden.

Für eine veröffentlichte Ausnahme muss `preisgarantie_ausnahmen_quelle` auf die konkrete Vertragsbedingung bzw. das belastbare Anbieter-Dokument verweisen.

## Kostenberechnung

Die wiederkehrenden Jahreskosten werden grundsätzlich als Grundpreis plus Verbrauch mal Arbeitspreis berechnet. Einmalige Boni werden nur für die Erstjahresbetrachtung abgezogen und separat ausgewiesen. Folgejahreskosten enthalten keine einmaligen Boni.

Netzentgelte, Steuern, Abgaben und Umsatzsteuer dürfen nicht ein zweites Mal addiert werden, wenn sie bereits Bestandteil des ausgewiesenen Endkundenpreises sind.

## Veröffentlichung

Ein Tarif darf nur veröffentlicht werden, wenn er einen zulässigen Prüfstatus besitzt, zur PLZ und Energieart passt, innerhalb seiner Verbrauchsgrenzen liegt und die rechtliche Validierung erfolgreich ist.

Ein Datensatz mit `verlaengerung_monate > 0` und `verlaengerung_kuendbar_jederzeit != true` wird nicht automatisch veröffentlicht.

## Grundversorgung

Für Grundversorgungstarife ist in der Kundendarstellung ausdrücklich anzugeben:

> Kündigung in Textform (z. B. E-Mail, Brief, Fax), Frist 2 Wochen, jederzeit möglich.

## Primärquellen

- § 309 Nr. 9 BGB: https://www.gesetze-im-internet.de/bgb/__309.html
- § 20 StromGVV: https://www.gesetze-im-internet.de/stromgvv/__20.html
- § 20 GasGVV: https://www.gesetze-im-internet.de/gasgvv/__20.html
- § 41 EnWG: https://www.gesetze-im-internet.de/enwg_2005/__41.html
- PAngV: https://www.gesetze-im-internet.de/pangv_2022/
