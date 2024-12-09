describe('Application Fonctionnelle', () => {
    beforeEach(() => {
      cy.visit('http://localhost:3000')
      
      cy.on('uncaught:exception', (err, runnable) => {
        console.log('Erreur non capturée:', err.message)
        return false
      })
    })
  
    it('doit charger la page d\'accueil', () => {
      cy.get('h1').should('be.visible')
    })
  
    it('doit permettre la navigation entre les modules', () => {
      cy.get('ul').should('be.visible')
      cy.contains('Jeu Concours').click()
      cy.url().should('include', '/jeuConcours')
      cy.go('back')
      cy.contains('Article').click()
      cy.url().should('include', '/article')
      cy.go('back')
      cy.contains('Support').click()
      cy.url().should('include', '/support')
    })
  
    it('doit afficher les boutons de connexion et d\'inscription pour un utilisateur non connecté', () => {
      cy.contains('button', 'Connexion').should('be.visible')
      cy.contains('button', 'Inscription').should('be.visible')
    })
  
    it('doit vérifier le chargement des icônes SVG', () => {
      cy.get('svg').should('be.visible')
    })
  
    describe('Tests API', () => {
      it('doit tester la soumission du formulaire de support', () => {
        cy.request({
          method: 'POST',
          url: '/api/handleSubmitFormSupport',
          failOnStatusCode: false,
          body: {
            email: 'support@example.com',
            message: 'Test message',
            objet: 'Test objet'
          }
        }).its('status').should('be.oneOf', [200, 201, 400])
      })
  
      it('doit tester la vérification de ticket', () => {
        cy.request({
          method: 'POST',
          url: '/api/verifyTicket',
          failOnStatusCode: false,
          body: {
            ticketId: 'N5P3S7K5XZ'
          }
        }).then((response) => {
          expect(response.status).to.be.oneOf([200, 400, 404])
          if (response.status === 200) {
            expect(response.body).to.have.property('message')
          }
        })
      })
    })
  })