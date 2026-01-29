"""
Скрипт для генерации тестовых пользователей и заявок на регистрацию.
Использование: python seed_data.py
"""
import asyncio
import random
import string
from datetime import datetime, timedelta

# Настройка пути для импортов
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.database import database, metadata
from app.database.models.user import User, UserRole
from app.database.models.registration_request import RegistrationRequest, RegistrationStatus
from app.utils.auth import get_password_hash

# Списки для генерации имён
FIRST_NAMES_RU = [
    "Александр", "Дмитрий", "Максим", "Иван", "Артём", "Никита", "Михаил", "Даниил",
    "Егор", "Андрей", "Кирилл", "Илья", "Алексей", "Роман", "Сергей", "Владислав",
    "Анна", "Мария", "Елена", "Ольга", "Наталья", "Екатерина", "Татьяна", "Ирина",
    "Светлана", "Юлия", "Дарья", "Алина", "Виктория", "Полина", "Ксения", "Валерия"
]

LAST_NAMES_RU = [
    "Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов",
    "Михайлов", "Новиков", "Фёдоров", "Морозов", "Волков", "Алексеев", "Лебедев",
    "Семёнов", "Егоров", "Павлов", "Козлов", "Степанов", "Николаев", "Орлов",
    "Андреев", "Макаров", "Никитин", "Захаров", "Зайцев", "Соловьёв", "Борисов"
]

DOMAINS = ["gmail.com", "yandex.ru", "mail.ru", "outlook.com", "example.com"]

MESSAGES = [
    "Хочу использовать систему для учёбы",
    "Преподаватель направил на регистрацию",
    "Нужен доступ для прохождения тестов",
    "Студент 2 курса, группа ИС-21",
    "Прошу одобрить заявку",
    "",
    None,
    "Интересует система тестирования",
    "Для работы в университете",
]


def random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def generate_username():
    return f"user_{random_string(6)}"


def generate_email(username):
    domain = random.choice(DOMAINS)
    return f"{username}@{domain}"


def random_date(days_back=30):
    return datetime.utcnow() - timedelta(
        days=random.randint(0, days_back),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59)
    )


async def seed_users(count: int):
    """Генерирует указанное количество пользователей"""
    print(f"\n📝 Генерация {count} пользователей...")
    
    hashed_password = get_password_hash("password123")  # Общий пароль для тестовых юзеров
    created = 0
    
    for i in range(count):
        username = generate_username()
        email = generate_email(username)
        first_name = random.choice(FIRST_NAMES_RU)
        last_name = random.choice(LAST_NAMES_RU)
        role = random.choices(
            [UserRole.STUDENT.value, UserRole.TEACHER.value],
            weights=[0.8, 0.2]  # 80% студенты, 20% преподаватели
        )[0]
        is_active = random.choices([True, False], weights=[0.9, 0.1])[0]
        
        try:
            await User.objects.create(
                username=username,
                email=email,
                hashed_password=hashed_password,
                first_name=first_name,
                last_name=last_name,
                role=role,
                is_active=is_active,
                created_at=random_date(60)
            )
            created += 1
            print(f"  ✓ [{created}/{count}] {username} ({first_name} {last_name}) - {role}")
        except Exception as e:
            print(f"  ✗ Ошибка создания {username}: {e}")
    
    print(f"\n✅ Создано пользователей: {created}/{count}")
    return created


async def seed_registration_requests(count: int):
    """Генерирует указанное количество заявок на регистрацию"""
    print(f"\n📝 Генерация {count} заявок на регистрацию...")
    
    hashed_password = get_password_hash("password123")
    created = 0
    
    for i in range(count):
        username = f"pending_{random_string(6)}"
        email = generate_email(username)
        first_name = random.choice(FIRST_NAMES_RU)
        last_name = random.choice(LAST_NAMES_RU)
        message = random.choice(MESSAGES)
        status = random.choices(
            [RegistrationStatus.PENDING.value, RegistrationStatus.APPROVED.value, RegistrationStatus.REJECTED.value],
            weights=[0.6, 0.25, 0.15]  # 60% pending, 25% approved, 15% rejected
        )[0]
        
        try:
            await RegistrationRequest.objects.create(
                username=username,
                email=email,
                hashed_password=hashed_password,
                first_name=first_name,
                last_name=last_name,
                message=message,
                status=status,
                created_at=random_date(30)
            )
            created += 1
            status_emoji = {"pending": "⏳", "approved": "✅", "rejected": "❌"}
            print(f"  {status_emoji.get(status, '?')} [{created}/{count}] {username} - {status}")
        except Exception as e:
            print(f"  ✗ Ошибка создания {username}: {e}")
    
    print(f"\n✅ Создано заявок: {created}/{count}")
    return created


async def main():
    print("=" * 50)
    print("🌱 Генератор тестовых данных для Quizz")
    print("=" * 50)
    
    await database.connect()
    
    try:
        while True:
            print("\nВыберите действие:")
            print("  1. Создать пользователей")
            print("  2. Создать заявки на регистрацию")
            print("  3. Создать и то, и другое")
            print("  4. Показать статистику")
            print("  0. Выход")
            
            choice = input("\nВаш выбор: ").strip()
            
            if choice == "0":
                print("\n👋 До свидания!")
                break
            
            elif choice == "1":
                try:
                    count = int(input("Количество пользователей: "))
                    if count > 0:
                        await seed_users(count)
                    else:
                        print("Количество должно быть > 0")
                except ValueError:
                    print("Введите число!")
            
            elif choice == "2":
                try:
                    count = int(input("Количество заявок: "))
                    if count > 0:
                        await seed_registration_requests(count)
                    else:
                        print("Количество должно быть > 0")
                except ValueError:
                    print("Введите число!")
            
            elif choice == "3":
                try:
                    users_count = int(input("Количество пользователей: "))
                    requests_count = int(input("Количество заявок: "))
                    if users_count > 0:
                        await seed_users(users_count)
                    if requests_count > 0:
                        await seed_registration_requests(requests_count)
                except ValueError:
                    print("Введите число!")
            
            elif choice == "4":
                users_count = await User.objects.count()
                requests_count = await RegistrationRequest.objects.count()
                pending_count = await RegistrationRequest.objects.filter(status=RegistrationStatus.PENDING.value).count()
                
                print(f"\n📊 Статистика:")
                print(f"  👤 Пользователей: {users_count}")
                print(f"  📋 Заявок всего: {requests_count}")
                print(f"  ⏳ Заявок на рассмотрении: {pending_count}")
            
            else:
                print("Неверный выбор!")
    
    finally:
        await database.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
