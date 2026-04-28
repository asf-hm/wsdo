import bcrypt from 'bcryptjs';
import { BookModel, LibraryModel, UserModel } from '../models';

const demoPassword = 'password123';

export async function seedData(): Promise<void> {
  const [cityLibrary, centralLibrary] = await Promise.all([
    LibraryModel.findOneAndUpdate(
      { name: 'City Library' },
      { name: 'City Library', location: 'New York' },
      { new: true, upsert: true }
    ),
    LibraryModel.findOneAndUpdate(
      { name: 'Central Library' },
      { name: 'Central Library', location: 'London' },
      { new: true, upsert: true }
    )
  ]);

  const passwordHash = await bcrypt.hash(demoPassword, 10);

  await Promise.all([
    UserModel.findOneAndUpdate(
      { username: 'alice' },
      {
        username: 'alice',
        password: passwordHash,
        country: 'US',
        libraries: [cityLibrary._id, centralLibrary._id],
        role: 'user'
      },
      { new: true, upsert: true }
    ),
    UserModel.findOneAndUpdate(
      { username: 'bob' },
      {
        username: 'bob',
        password: passwordHash,
        country: 'GB',
        libraries: [centralLibrary._id],
        role: 'user'
      },
      { new: true, upsert: true }
    )
  ]);

  const sampleBooks = [
    {
      title: 'Practical Node APIs',
      author: 'Jane Carter',
      authorCountry: 'US',
      publishedDate: new Date('2017-03-12'),
      pages: 420,
      library: cityLibrary._id
    },
    {
      title: 'Distributed Systems Notes',
      author: 'Arthur Finch',
      authorCountry: 'GB',
      publishedDate: new Date('1999-09-18'),
      pages: 780,
      library: centralLibrary._id
    },
    {
      title: 'The Archive Pattern',
      author: 'Claire Dubois',
      authorCountry: 'FR',
      publishedDate: new Date('1988-01-07'),
      pages: 260,
      library: centralLibrary._id
    },
    {
      title: 'Modern Data Modeling',
      author: 'Maya Reed',
      authorCountry: 'US',
      publishedDate: new Date('2011-06-25'),
      pages: 640,
      library: cityLibrary._id
    }
  ];

  await Promise.all(
    sampleBooks.map((book) =>
      BookModel.findOneAndUpdate({ title: book.title }, book, {
        new: true,
        upsert: true,
        runValidators: true
      })
    )
  );
}
