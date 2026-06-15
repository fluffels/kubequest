/* ===== Inhalte: virtuelle Dateien =====
 * Fertige YAML-/Terraform-/CI-Schnipsel, die Quests dem Spieler im
 * simulierten Dateisystem hinlegen (zum Lesen, Anwenden, Reparieren).
 */

export const DEPLOYMENT_YAML = [
  "apiVersion: apps/v1", "kind: Deployment", "metadata:", "  name: lager", "spec:",
  "  replicas: 2", "  selector:", "    matchLabels:", "      app: lager", "  template:",
  "    metadata:", "      labels:", "        app: lager", "    spec:", "      containers:",
  "        - name: lager", "          image: redis:7", "          ports:", "            - containerPort: 6379",
].join("\n");

export const SERVICE_YAML = [
  "apiVersion: v1", "kind: Service", "metadata:", "  name: lager", "spec:",
  "  selector:", "    app: lager", "  ports:", "    - port: 6379",
].join("\n");

export const INGRESS_YAML = [
  "apiVersion: networking.k8s.io/v1", "kind: Ingress", "metadata:", "  name: hafentor", "spec:",
  "  ingressClassName: nginx", "  rules:", "    - host: hafen.de", "      http:", "        paths:",
  "          - path: /lager", "            pathType: Prefix", "            backend:",
  "              service:", "                name: lager", "                port:",
  "                  number: 6379",
].join("\n");

export const BOESE_CONFIG_YAML = [
  "apiVersion: v1", "kind: ConfigMap", "metadata:", "  name: kasse-config", "data:",
  "  datenbank_host: db.hafen.local", "  # AUTSCH – Passwort im Klartext! Krakenfutter!",
  "  datenbank_passwort: fisch123",
].join("\n");

export const MAIN_TF = [
  "terraform {", "  required_providers {", "    hafen = {", "      source = \"kubequest/hafen\"", "    }", "  }", "}",
  "", "# Ein neues Ost-Plateau für Port Kubernia",
  "resource \"hafen_plateau\" \"ost\" {", "  name   = \"ost-erweiterung\"", "  breite = 12", "}",
  "", "# Zwei Server für den wachsenden Cluster",
  "resource \"hafen_server\" \"worker\" {", "  count   = 2", "  name    = \"worker-${count.index + 3}\"", "  groesse = \"mittel\"", "}",
].join("\n");

export const GITLAB_CI_YML = [
  "stages:", "  - build", "  - test", "  - deploy", "",
  "build-image:        # baut aus dem Dockerfile ein Docker-Image",
  "  stage: build", "  script:", "    - docker build -t funkdienst:$CI_COMMIT_SHORT_SHA .", "",
  "unit-test:          # prueft den Code, BEVOR etwas live geht",
  "  stage: test", "  script:", "    - npm test", "",
  "deploy-cluster:     # rollt automatisch in den Cluster aus",
  "  stage: deploy", "  script:", "    - kubectl apply -f deployment.yaml",
  "  only:", "    - main          # nur vom main-Branch wird wirklich deployt",
].join("\n");

export const DOCKERFILE = [
  "FROM nginx:1.27", "COPY site/ /usr/share/nginx/html", "EXPOSE 80",
].join("\n");
