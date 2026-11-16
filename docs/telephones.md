# Jouer sur téléphone

## Préparer une séance

1. Sur l’ordinateur relié à la table, lancer `npm ci`, `npm run build`, puis `npm start`. Ouvrir l’adresse locale annoncée dans Chrome ou Edge et passer en plein écran.
2. Pour le volant par inclinaison, démarrer avec un certificat de confiance sur le Wi-Fi ou avec un tunnel. Ouvrir l’adresse HTTPS annoncée sur les téléphones. Les flèches tactiles sont disponibles aussi en HTTP. [Configuration HTTPS](../README.md#https-pour-les-téléphones)
3. Scanner le QR de l’accueil. Si le scan échoue, ouvrir l’adresse affichée qui se termine par `/play`, puis saisir le code. Choisir **Cyan** ou **Rose**, puis **Pilote** ou **Copilote**. La table affiche les places disponibles, connectées et momentanément absentes.
4. Pour le grand circuit, attendre que la table affiche les quatre joueurs connectés avant de toucher **COURSE**. La surface se fixe pour la manche. Une partie mixte garde les commandes des rôles qui jouent sur la table. Les joueurs du tutoriel confirment leur place avec **Réparer**, sur leur téléphone ou sur la table.
5. Dessiner et démarrer sur la table. En mode mixte, un rôle dont le téléphone se déconnecte retrouve ses commandes locales. Pendant une course avec le grand circuit, reprendre la place sur un téléphone pour retrouver les commandes.

**Changer de place** libère la réservation avant le départ. Après une coupure ou un rechargement, rouvrir le même onglet pour retrouver sa place. Une réservation hors ligne expire après une minute avant la course et cinq minutes dès la course ou jusqu’au résultat. Le retour à l’accueil conserve les places.

## Commandes

| Interface | Commandes et informations |
|---|---|
| Pilote | **Activer le volant**, tenir le téléphone droit pendant la calibration, puis l’incliner. Utiliser **Calibrer** pour refaire le neutre. Les flèches prennent le relais si le capteur est indisponible. Basculer entre avance auto et pédale, maintenir **Accélérer** en mode pédale ou incliner le téléphone vers l’avant, et maintenir **Réparer** avec son copilote. **Vue** fait défiler le plan local et les deux vues en perspective. |
| Copilote | **Armer le bonus**, puis réaliser son geste sur la table. Pour le mur et les piliers, **Annoncer la pose**, poser les deux doigts sur la table, puis utiliser les commandes d’activation et de retrait selon le besoin. Maintenir **Réparer** en même temps que le pilote. |
| Copilote · Mode accessibilité | Activer le mode, choisir l’objet ou le bonus armé, puis choisir une position sur la carte ou avec le curseur le long de la piste. Ajuster la position ou l’orientation, vérifier le retour textuel et confirmer. |
| Table | Tracer le circuit, lancer et mettre en pause, voir les deux équipes et la totalité du circuit, effectuer les gestes et poser les objets. Les six ambiances se sélectionnent dans **Paramètres → Ambiance** et se synchronisent avec les vues du pilote. |

Les vues en perspective montrent la chaussée et les obstacles proches. La table reste le repère commun pour voir le parcours entier, le jeu de l’autre équipe et préparer les gestes avec son copilote. Le plan du pilote est centré sur la voiture par défaut et propose un cadrage entier à la demande.

## Dépannage

- **QR sans connexion**. Mettre les appareils sur un réseau qui leur permet de communiquer. Un Wi-Fi invité peut isoler les appareils. Pour un certificat local, utiliser l’adresse incluse dans le certificat et approuver l’autorité sur le téléphone.
- **Volant indisponible**. Sur iPhone, ouvrir Safari en HTTPS puis toucher **Activer le volant** et accepter la permission. Sur Android dans Chrome, vérifier que la page est en HTTPS, puis tenir l’écran incliné comme un volant pendant la calibration. Si la permission reste refusée ou qu’aucune mesure n’arrive, les flèches sont utilisables immédiatement.
- **Port occupé**. Arrêter l’ancien serveur ou démarrer avec `PORT=3100 npm start`. En cas de tunnel, mettre à jour également le port du tunnel.
- **Pose manuelle indisponible sur le téléphone**. La console Oz doit être en mode **Pose avec les doigts** pour annoncer les objets ou confirmer leur pose à distance.

## Protocole

Le client joueur utilise `/ws/player`. `Join` contient le code de séance et une place, ou le code et un jeton de reprise. `Joined` renvoie ce jeton à son seul propriétaire. Les états publics diffusent les places et leur disponibilité. `JoinRejected` signale un code inconnu, une place prise, une séance complète ou un jeton expiré. `Leave` libère une place avant la course.

Le pilote envoie `PilotInput`, `ToggleDriveMode` et `PadHold`. Le copilote envoie `Power`, `PadHold` et les commandes de pose et de gestion des objets. `SetAccessibility` autorise son `RemotePlace`. Le serveur reconstruit le geste, applique les validations ordinaires et renvoie un `PlacementResult` privé. L’équipe et le rôle sont déterminés par la place. La table seule envoie `SetTheme` et confirme les contacts physiques.

## Recette sur appareils

À réaliser avec la table, quatre places et au moins un iPhone sous Safari et un Android sous Chrome. Reporter les appareils, versions et résultats dans la [fiche de séance](sessions-de-test.md#recette-smartphone).

- [ ] Scanner le même QR sur quatre appareils, vérifier les quatre postes et tester une place disputée.
- [ ] Pendant la préparation, tester une place sur téléphone et trois à la table. Avec les quatre téléphones, vérifier la surface élargie et l’absence de postes personnels.
- [ ] Sur iPhone et Android en HTTPS, accepter le capteur, tourner à gauche et à droite, calibrer après rotation de l’écran, puis vérifier le repli tactile après refus de permission.
- [ ] Verrouiller un écran 30 s, revenir au jeu et vérifier que la place est reprise, sans braquage ni réparation restés actifs.
- [ ] Pendant un tour complet, basculer entre les trois vues et changer les six ambiances. Relever la fluidité sur chaque téléphone et noter les moments où le pilote regarde spontanément la table.
- [ ] Annoncer un mur depuis le téléphone, le poser avec deux doigts sur la table, puis armer et déclencher un bonus par un geste. Effectuer une réparation coordonnée.
- [ ] Avec VoiceOver puis TalkBack, placer un mur et un bonus depuis le curseur accessible. Tester aussi une position invalide et la confirmation au lecteur d’écran.
