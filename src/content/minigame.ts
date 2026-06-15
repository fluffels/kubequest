/* ===== Inhalte: Minispiel & Sturm-Helfer =====
 * Stapel-Spiel (Docker-Image-Schichten in die richtige Reihenfolge bringen)
 * und ein kleiner Helfer, der Image-Namen für Sturm-Events verfälscht.
 */

/* ---------- Stapel-Spiel: Docker-Image-Schichten ---------- */
export const STACK_ROUNDS = [
  { name: "Webserver-Image", layers: ["FROM ubuntu (Basis-Betriebssystem)", "RUN apt install nginx (Software installieren)", "COPY index.html (deine Dateien)", "CMD nginx (Startbefehl)"] },
  { name: "Python-App", layers: ["FROM python:3.12 (Basis mit Python)", "COPY requirements.txt (Abhängigkeiten-Liste)", "RUN pip install (Bibliotheken installieren)", "COPY app.py (dein Code)", "CMD python app.py (Startbefehl)"] },
  { name: "Java-Dienst", layers: ["FROM eclipse-temurin (Basis mit Java)", "COPY build/libs/app.jar (das fertige Programm)", "EXPOSE 8080 (Port freigeben)", "CMD java -jar app.jar (Startbefehl)"] },
];

/** Buchstabendreher für Sturm-Events: macht aus jedem Image-Namen garantiert einen anderen. */
export function corruptImage(img: string) {
  for (let i = 1; i < img.length - 1; i++) {
    if (img[i] !== img[i + 1]) return img.slice(0, i) + img[i + 1] + img[i] + img.slice(i + 2);
  }
  return img + "x";
}
