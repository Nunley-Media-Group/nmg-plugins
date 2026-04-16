# SOLID Principles Compliance

[Back to main skill](../SKILL.md)

Evaluate the implementation against SOLID principles. These apply to any object-oriented or module-based codebase.

---

## Single Responsibility Principle (SRP)

Each module, class, or function should have one reason to change.

- [ ] Each handler/controller handles ONE resource or domain
- [ ] Each service handles ONE business domain
- [ ] Each data access module handles ONE entity
- [ ] Middleware/interceptors do ONE thing each
- [ ] No "god files" with 500+ lines

### Red Flags

- Files named `utils`, `helpers`, `common`, `manager` doing too much
- Handlers/controllers with 10+ route handlers
- Services importing 5+ data access modules
- Middleware doing validation + auth + logging in one function

---

## Open/Closed Principle (OCP)

Software should be open for extension but closed for modification.

- [ ] New features added via new files, not modifying existing ones
- [ ] Strategy pattern for varying behavior (auth providers, storage backends)
- [ ] Plugin/extension points for external integrations
- [ ] Configuration-driven behavior changes

---

## Liskov Substitution Principle (LSP)

Subtypes should be substitutable for their base types.

- [ ] Data access interfaces allow different implementations (mock, in-memory, production)
- [ ] Service interfaces enable test doubles
- [ ] External API clients implement common interfaces

---

## Interface Segregation Principle (ISP)

Clients should not depend on interfaces they don't use.

- [ ] Small, focused interfaces over large monolithic ones
- [ ] Consumers don't depend on methods they don't call
- [ ] Separate read/write interfaces if needed

---

## Dependency Inversion Principle (DIP)

High-level modules should depend on abstractions, not concrete implementations.

- [ ] High-level modules depend on abstractions (interfaces/contracts)
- [ ] Dependency injection used for testability
- [ ] No hard-coded `new ConcreteClass()` in business logic
- [ ] Configuration and secrets injected, not imported directly

---

## Scoring Guide

| Principle | Score 1 | Score 3 | Score 5 |
|-----------|---------|---------|---------|
| SRP | God files, mixed concerns | Some separation | Clean single responsibility |
| OCP | Modify core for every feature | Some extension points | Plugin architecture |
| LSP | Concrete dependencies everywhere | Some interfaces | Full substitutability |
| ISP | Monolithic interfaces | Partial segregation | Focused interfaces |
| DIP | Hard-coded dependencies | Partial DI | Full DI with interfaces |
